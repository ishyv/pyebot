/**
 * Banned-image AutoMod detector.
 *
 * Moderators manage the pool as per-guild hash records. Message scanning
 * fetches only current attachments, hashes them locally, then emits normal
 * AutoMod signals so policy and sanctions stay centralized.
 */

import type { Attachment, Message } from "discord.js";
import { BannedImages, type BannedImageValue } from "@/components/banned-image";
import { Guild } from "@/components/entities";
import { createLogger } from "@/core/logger";
import type { AutomodConfig } from "@/db/schemas/guild";
import type { EntityContext } from "@/framework/entity-context";
import { buildCorrelationId } from "@/utils/ids";
import {
  hashImageBuffer,
  type ImageHashDistance,
  type ImageHashes,
  imageHashDistance,
  isImageHashMatch,
} from "./imageHash";
import type { AutomodSignal } from "./signals";

const log = createLogger("automod:banned-images");
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif"]);

export interface BannedImageRecord extends BannedImageValue {
  /** The record's short id — its key in the guild's banned-image map. */
  readonly id: string;
}

export interface AddBannedImageInput {
  readonly guildId: string;
  readonly actorId: string;
  readonly reason: string;
  readonly label?: string | null;
  readonly sourceUrl: string | null;
  readonly sourceContentType?: string | null;
  readonly sourceFilename?: string | null;
  readonly hashes: ImageHashes;
}

export interface BannedImageMatch {
  readonly record: BannedImageRecord;
  readonly distance: ImageHashDistance;
}

export interface ImageAttachmentCandidate {
  readonly id: string;
  readonly url: string;
  readonly contentType: string | null;
  readonly filename: string | null;
  readonly size: number | null;
}

/** Lists active banned-image records for a guild, newest first. */
export async function listActiveBannedImages(
  entities: EntityContext,
  guildId: string,
): Promise<BannedImageRecord[]> {
  const { records } = await entities.of(Guild, guildId).get(BannedImages);
  return Object.entries(records)
    .filter(([, value]) => value.status === "active")
    .map(([id, value]) => ({ ...value, id }))
    .sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime());
}

/** Stores one active banned-image hash record. */
export async function addBannedImage(
  entities: EntityContext,
  input: AddBannedImageInput,
): Promise<BannedImageRecord> {
  const id = buildCorrelationId();
  const value: BannedImageValue = {
    guildId: input.guildId,
    status: "active",
    reason: input.reason,
    label: input.label?.trim() || null,
    sourceUrl: input.sourceUrl,
    sourceContentType: input.sourceContentType ?? null,
    sourceFilename: input.sourceFilename ?? null,
    hashes: input.hashes,
    addedBy: input.actorId,
    addedAt: new Date(),
    removedBy: null,
    removedAt: null,
  };
  await entities
    .of(Guild, input.guildId)
    .update(BannedImages, (s) => ({ records: { ...s.records, [id]: value } }));
  return { ...value, id };
}

/** Soft-removes an active banned-image record, preserving audit metadata. */
export async function removeBannedImage(
  entities: EntityContext,
  guildId: string,
  id: string,
  actorId: string,
): Promise<BannedImageRecord | null> {
  const handle = entities.of(Guild, guildId);
  const current = (await handle.get(BannedImages)).records[id];
  if (!current || current.status !== "active") return null;

  const updated: BannedImageValue = {
    ...current,
    status: "removed",
    removedBy: actorId,
    removedAt: new Date(),
  };
  await handle.update(BannedImages, (s) => ({ records: { ...s.records, [id]: updated } }));
  return { ...updated, id };
}

/** Updates moderator-facing metadata on an active banned-image record. */
export async function editBannedImage(
  entities: EntityContext,
  guildId: string,
  id: string,
  patch: { readonly reason?: string; readonly label?: string | null },
): Promise<BannedImageRecord | null> {
  const next: Partial<BannedImageValue> = {};
  if (patch.reason !== undefined) next.reason = patch.reason;
  if (patch.label !== undefined) next.label = patch.label?.trim() || null;
  if (Object.keys(next).length === 0) return null;

  const handle = entities.of(Guild, guildId);
  const current = (await handle.get(BannedImages)).records[id];
  if (!current || current.status !== "active") return null;

  const updated: BannedImageValue = { ...current, ...next };
  await handle.update(BannedImages, (s) => ({ records: { ...s.records, [id]: updated } }));
  return { ...updated, id };
}

/** Returns the short id moderators use in list/remove command output. */
export function displayBannedImageId(record: Pick<BannedImageRecord, "id">): string {
  return record.id;
}

/** Finds the closest active banned image within the configured tolerance. */
export function findBannedImageMatch(
  hashes: ImageHashes,
  records: readonly BannedImageRecord[],
  tolerance: AutomodConfig["imageDetection"]["tolerance"],
): BannedImageMatch | null {
  let best: BannedImageMatch | null = null;
  for (const record of records) {
    const distance = imageHashDistance(hashes, record.hashes);
    if (!isImageHashMatch(distance, tolerance)) continue;
    if (!best || distance.total < best.distance.total) best = { record, distance };
  }
  return best;
}

function extensionFromUrlOrName(value: string | null | undefined): string | null {
  if (!value) return null;
  const clean = value.split("?")[0]?.split("#")[0] ?? value;
  const ext = clean.split(".").pop()?.toLowerCase();
  return ext && IMAGE_EXTENSIONS.has(ext) ? ext : null;
}

/** Narrows Discord attachments to image formats sharp can decode for v1. */
export function isSupportedImageAttachment(
  attachment: Pick<Attachment, "contentType" | "name" | "url">,
): boolean {
  if (attachment.contentType?.startsWith("image/"))
    return attachment.contentType !== "image/svg+xml";
  return Boolean(extensionFromUrlOrName(attachment.name) ?? extensionFromUrlOrName(attachment.url));
}

function imageAttachmentCandidates(message: Message): ImageAttachmentCandidate[] {
  return [...message.attachments.values()].filter(isSupportedImageAttachment).map((attachment) => ({
    id: attachment.id,
    url: attachment.url,
    contentType: attachment.contentType,
    filename: attachment.name,
    size: attachment.size ?? null,
  }));
}

/** Fetches an image attachment under the detector size limit. */
export async function fetchImageAttachmentBuffer(
  candidate: Pick<ImageAttachmentCandidate, "url" | "size">,
): Promise<Buffer | null> {
  if (candidate.size !== null && candidate.size > MAX_IMAGE_BYTES) return null;
  const response = await fetch(candidate.url);
  if (!response.ok) return null;
  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (contentLength > MAX_IMAGE_BYTES) return null;
  const bytes = Buffer.from(await response.arrayBuffer());
  return bytes.byteLength <= MAX_IMAGE_BYTES ? bytes : null;
}

function signalForMatch(
  message: Message,
  candidate: ImageAttachmentCandidate,
  match: BannedImageMatch,
): AutomodSignal {
  const id = displayBannedImageId(match.record);
  const label = match.record.label ? ` (${match.record.label})` : "";
  return {
    detectorId: "bannedImage",
    ruleId: id,
    confidence: 0.97,
    severity: "critical",
    punishmentEligible: true,
    recommendedAction: "delete",
    target: {
      guildId: message.guild?.id ?? match.record.guildId,
      userId: message.author.id,
      channelId: message.channelId,
      messageId: message.id,
    },
    evidence: {
      summary: `Banned image match ${id}${label}: ${match.record.reason}`,
      fingerprint: `banned-image:${id}`,
      metadata: {
        bannedImageId: id,
        averageDistance: match.distance.average,
        differenceDistance: match.distance.difference,
        verticalDistance: match.distance.verticalDifference,
        totalDistance: match.distance.total,
        attachmentId: candidate.id,
        filename: candidate.filename ?? "unknown",
      },
    },
    createdAt: new Date().toISOString(),
  };
}

/** Detects banned-image matches from current message attachments. */
export async function detectBannedImageSignals(
  entities: EntityContext,
  message: Message,
  config: AutomodConfig,
): Promise<AutomodSignal[]> {
  if (!message.guild || !config.imageDetection.enabled) return [];
  const candidates = imageAttachmentCandidates(message);
  if (candidates.length === 0) return [];

  const records = await listActiveBannedImages(entities, message.guild.id);
  if (records.length === 0) return [];

  const signals: AutomodSignal[] = [];
  for (const candidate of candidates) {
    try {
      const bytes = await fetchImageAttachmentBuffer(candidate);
      if (!bytes) continue;
      const hashes = await hashImageBuffer(bytes);
      const match = findBannedImageMatch(hashes, records, config.imageDetection.tolerance);
      if (match) signals.push(signalForMatch(message, candidate, match));
    } catch (error) {
      log.warn(`Skipping image attachment ${candidate.id} in ${message.guild.id}.`, error);
    }
  }
  return signals;
}
