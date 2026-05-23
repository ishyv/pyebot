/**
 * Banned-image AutoMod detector.
 *
 * Moderators manage the pool as per-guild hash records. Message scanning
 * fetches only current attachments, hashes them locally, then emits normal
 * AutoMod signals so policy and sanctions stay centralized.
 */

import type { Attachment, Message } from "discord.js";
import { BannedImage, type BannedImageValue, bannedImageId } from "@/components/banned-image";
import { getDb } from "@/core/db";
import { createLogger } from "@/core/logger";
import type { AutomodConfig } from "@/db/schemas/guild";
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
  readonly _id: string;
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

/** Lists active banned-image records for a guild. */
export async function listActiveBannedImages(guildId: string): Promise<BannedImageRecord[]> {
  const db = await getDb();
  const docs = await db
    .collection(BannedImage.collection)
    .find({ guildId, status: "active" })
    .sort({ addedAt: -1 })
    .toArray();
  return docs.map((doc) => {
    const parsed = BannedImage.schema.parse(doc);
    return { ...parsed, _id: String(doc._id) };
  });
}

/** Stores one active banned-image hash record. */
export async function addBannedImage(input: AddBannedImageInput): Promise<BannedImageRecord> {
  const id = buildCorrelationId();
  const doc: BannedImageRecord = {
    _id: bannedImageId(input.guildId, id),
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
  const db = await getDb();
  await db.collection(BannedImage.collection).insertOne(doc as never);
  return doc;
}

/** Soft-removes a banned-image record, preserving audit metadata. */
export async function removeBannedImage(
  guildId: string,
  id: string,
  actorId: string,
): Promise<BannedImageRecord | null> {
  const db = await getDb();
  const _id = id.includes(":") ? id : bannedImageId(guildId, id);
  const removedAt = new Date();
  const doc = await db.collection(BannedImage.collection).findOneAndUpdate(
    { _id, guildId, status: "active" } as never,
    {
      $set: {
        status: "removed",
        removedBy: actorId,
        removedAt,
      },
    } as never,
    { returnDocument: "after" },
  );
  if (!doc) return null;
  const parsed = BannedImage.schema.parse(doc);
  return { ...parsed, _id: String(doc._id) };
}

/** Updates moderator-facing metadata on an active banned-image record. */
export async function editBannedImage(
  guildId: string,
  id: string,
  patch: { readonly reason?: string; readonly label?: string | null },
): Promise<BannedImageRecord | null> {
  const $set: Record<string, unknown> = {};
  if (patch.reason !== undefined) $set.reason = patch.reason;
  if (patch.label !== undefined) $set.label = patch.label?.trim() || null;
  if (Object.keys($set).length === 0) return null;

  const db = await getDb();
  const _id = id.includes(":") ? id : bannedImageId(guildId, id);
  const doc = await db
    .collection(BannedImage.collection)
    .findOneAndUpdate({ _id, guildId, status: "active" } as never, { $set } as never, {
      returnDocument: "after",
    });
  if (!doc) return null;
  const parsed = BannedImage.schema.parse(doc);
  return { ...parsed, _id: String(doc._id) };
}

/** Returns the short id moderators use in list/remove command output. */
export function displayBannedImageId(record: Pick<BannedImageRecord, "_id" | "guildId">): string {
  const prefix = `${record.guildId}:`;
  return record._id.startsWith(prefix) ? record._id.slice(prefix.length) : record._id;
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
  message: Message,
  config: AutomodConfig,
): Promise<AutomodSignal[]> {
  if (!message.guild || !config.imageDetection.enabled) return [];
  const candidates = imageAttachmentCandidates(message);
  if (candidates.length === 0) return [];

  const records = await listActiveBannedImages(message.guild.id);
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
