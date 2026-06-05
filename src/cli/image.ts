import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  addBannedImage,
  displayBannedImageId,
  editBannedImage,
  findBannedImageMatch,
  listActiveBannedImages,
  removeBannedImage,
} from "@/features/automod/bannedImages";
import { hashImageBuffer, type ImageMatchTolerance } from "@/features/automod/imageHash";
import { type EntityContext, headlessEntityContext } from "@/framework/entity-context";
import type { ImageCliCommand } from "./types";

type ImageAction = "add" | "edit" | "remove" | "test";

const CONTENT_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/** Runs the DB-backed banned-image utility commands. */
export async function runImageCommand(args: ImageCliCommand): Promise<void> {
  const action = args.action as ImageAction | null;
  const entities = await headlessEntityContext();
  if (action === "add") return addImage(entities, args);
  if (action === "test") return testImage(entities, args);
  if (action === "remove") return removeImage(entities, args);
  if (action === "edit") return editImage(entities, args);
  throw new Error(`Unknown image action: ${args.action ?? "(missing)"}`);
}

function stringOption(args: ImageCliCommand, name: string): string | null {
  const value = args.options[name];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requireGuildId(args: ImageCliCommand): string {
  const guildId = stringOption(args, "guild") ?? process.env.TX_GUILD_ID ?? process.env.GUILD_ID;
  if (!guildId?.trim()) throw new Error("Missing guild id. Pass --guild <id> or set TX_GUILD_ID.");
  return guildId.trim();
}

function actorId(args: ImageCliCommand): string {
  return stringOption(args, "actor") ?? process.env.TX_ACTOR_ID ?? "cli";
}

function contentTypeForPath(path: string): string | null {
  return CONTENT_TYPES[extname(path).toLowerCase()] ?? null;
}

async function hashFile(path: string) {
  const absolute = resolve(path);
  const bytes = await readFile(absolute);
  return {
    absolute,
    hashes: await hashImageBuffer(bytes),
  };
}

function tolerance(args: ImageCliCommand): ImageMatchTolerance {
  const value = stringOption(args, "tolerance") ?? "balanced";
  if (value === "strict" || value === "balanced" || value === "loose") return value;
  throw new Error("Invalid tolerance. Use strict, balanced, or loose.");
}

async function resolveRecordId(
  entities: EntityContext,
  guildId: string,
  target: string,
  matchTolerance: ImageMatchTolerance,
) {
  if (!existsSync(target)) return target;
  const { hashes } = await hashFile(target);
  const records = await listActiveBannedImages(entities, guildId);
  const match = findBannedImageMatch(hashes, records, matchTolerance);
  if (!match) throw new Error("No active banned-image record matches that file.");
  return displayBannedImageId(match.record);
}

async function addImage(entities: EntityContext, args: ImageCliCommand): Promise<void> {
  if (!args.target) throw new Error("Missing image path.");
  const reason = stringOption(args, "reason");
  if (!reason) throw new Error("Missing reason. Pass --reason <text>.");
  const guildId = requireGuildId(args);
  const { absolute, hashes } = await hashFile(args.target);
  const record = await addBannedImage(entities, {
    guildId,
    actorId: actorId(args),
    reason,
    label: stringOption(args, "label"),
    sourceUrl: pathToFileURL(absolute).toString(),
    sourceContentType: contentTypeForPath(absolute),
    sourceFilename: absolute,
    hashes,
  });
  console.log(`Added banned image ${displayBannedImageId(record)} for guild ${guildId}.`);
  console.log(`Reason: ${record.reason}`);
}

async function testImage(entities: EntityContext, args: ImageCliCommand): Promise<void> {
  if (!args.target) throw new Error("Missing image path.");
  const guildId = requireGuildId(args);
  const { hashes } = await hashFile(args.target);
  const records = await listActiveBannedImages(entities, guildId);
  const match = findBannedImageMatch(hashes, records, tolerance(args));
  if (!match) {
    console.log(`No banned-image match in guild ${guildId}. Checked ${records.length} record(s).`);
    return;
  }
  console.log(`Matched banned image ${displayBannedImageId(match.record)} in guild ${guildId}.`);
  console.log(`Reason: ${match.record.reason}`);
  if (match.record.label) console.log(`Label: ${match.record.label}`);
  console.log(
    `Distance: average=${match.distance.average}, difference=${match.distance.difference}, vertical=${match.distance.verticalDifference}, total=${match.distance.total}`,
  );
}

async function removeImage(entities: EntityContext, args: ImageCliCommand): Promise<void> {
  if (!args.target) throw new Error("Missing banned image id or image path.");
  const guildId = requireGuildId(args);
  const id = await resolveRecordId(entities, guildId, args.target, tolerance(args));
  const removed = await removeBannedImage(entities, guildId, id, actorId(args));
  if (!removed) throw new Error(`No active banned-image record found for ${id}.`);
  console.log(`Removed banned image ${displayBannedImageId(removed)} from guild ${guildId}.`);
}

async function editImage(entities: EntityContext, args: ImageCliCommand): Promise<void> {
  if (!args.target) throw new Error("Missing banned image id or image path.");
  const reason = stringOption(args, "reason");
  const label = stringOption(args, "label");
  if (reason === null && label === null) throw new Error("Pass --reason, --label, or both.");
  const guildId = requireGuildId(args);
  const id = await resolveRecordId(entities, guildId, args.target, tolerance(args));
  const edited = await editBannedImage(entities, guildId, id, {
    ...(reason !== null ? { reason } : {}),
    ...(label !== null ? { label } : {}),
  });
  if (!edited) throw new Error(`No active banned-image record found for ${id}.`);
  console.log(`Edited banned image ${displayBannedImageId(edited)} in guild ${guildId}.`);
  console.log(`Reason: ${edited.reason}`);
  console.log(`Label: ${edited.label ?? "none"}`);
}
