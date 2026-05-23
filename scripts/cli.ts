/**
 * tx local CLI.
 *
 * Currently focused on developer/moderator utilities that need direct DB
 * access without going through Discord interactions.
 */

import "dotenv/config";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { disconnectDb } from "@/core/db";
import {
  addBannedImage,
  displayBannedImageId,
  editBannedImage,
  findBannedImageMatch,
  listActiveBannedImages,
  removeBannedImage,
} from "@/features/automod/bannedImages";
import { hashImageBuffer, type ImageMatchTolerance } from "@/features/automod/imageHash";

type ImageAction = "add" | "edit" | "remove" | "test";

interface ParsedArgs {
  readonly command: string | null;
  readonly action: string | null;
  readonly target: string | null;
  readonly options: Readonly<Record<string, string | boolean>>;
}

const CONTENT_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function usage(): string {
  return [
    "Usage:",
    "  tx image add <path> --guild <id> --reason <text> [--label <text>] [--actor <id>]",
    "  tx image test <path> --guild <id> [--tolerance strict|balanced|loose]",
    "  tx image remove <id-or-path> --guild <id> [--actor <id>]",
    "  tx image edit <id-or-path> --guild <id> [--reason <text>] [--label <text>]",
    "",
    "Env fallbacks:",
    "  TX_GUILD_ID or GUILD_ID for --guild",
    "  TX_ACTOR_ID for --actor",
  ].join("\n");
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const positional: string[] = [];
  const options: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
      continue;
    }
    options[key] = next;
    i++;
  }
  return {
    command: positional[0] ?? null,
    action: positional[1] ?? null,
    target: positional[2] ?? null,
    options,
  };
}

function stringOption(args: ParsedArgs, name: string): string | null {
  const value = args.options[name];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requireGuildId(args: ParsedArgs): string {
  const guildId = stringOption(args, "guild") ?? process.env.TX_GUILD_ID ?? process.env.GUILD_ID;
  if (!guildId?.trim()) throw new Error("Missing guild id. Pass --guild <id> or set TX_GUILD_ID.");
  return guildId.trim();
}

function actorId(args: ParsedArgs): string {
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

function tolerance(args: ParsedArgs): ImageMatchTolerance {
  const value = stringOption(args, "tolerance") ?? "balanced";
  if (value === "strict" || value === "balanced" || value === "loose") return value;
  throw new Error("Invalid tolerance. Use strict, balanced, or loose.");
}

async function resolveRecordId(
  guildId: string,
  target: string,
  matchTolerance: ImageMatchTolerance,
) {
  if (!existsSync(target)) return target;
  const { hashes } = await hashFile(target);
  const records = await listActiveBannedImages(guildId);
  const match = findBannedImageMatch(hashes, records, matchTolerance);
  if (!match) throw new Error("No active banned-image record matches that file.");
  return displayBannedImageId(match.record);
}

async function addImage(args: ParsedArgs): Promise<void> {
  if (!args.target) throw new Error("Missing image path.");
  const reason = stringOption(args, "reason");
  if (!reason) throw new Error("Missing reason. Pass --reason <text>.");
  const guildId = requireGuildId(args);
  const { absolute, hashes } = await hashFile(args.target);
  const record = await addBannedImage({
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

async function testImage(args: ParsedArgs): Promise<void> {
  if (!args.target) throw new Error("Missing image path.");
  const guildId = requireGuildId(args);
  const { hashes } = await hashFile(args.target);
  const records = await listActiveBannedImages(guildId);
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

async function removeImage(args: ParsedArgs): Promise<void> {
  if (!args.target) throw new Error("Missing banned image id or image path.");
  const guildId = requireGuildId(args);
  const id = await resolveRecordId(guildId, args.target, tolerance(args));
  const removed = await removeBannedImage(guildId, id, actorId(args));
  if (!removed) throw new Error(`No active banned-image record found for ${id}.`);
  console.log(`Removed banned image ${displayBannedImageId(removed)} from guild ${guildId}.`);
}

async function editImage(args: ParsedArgs): Promise<void> {
  if (!args.target) throw new Error("Missing banned image id or image path.");
  const reason = stringOption(args, "reason");
  const label = stringOption(args, "label");
  if (reason === null && label === null) throw new Error("Pass --reason, --label, or both.");
  const guildId = requireGuildId(args);
  const id = await resolveRecordId(guildId, args.target, tolerance(args));
  const edited = await editBannedImage(guildId, id, {
    ...(reason !== null ? { reason } : {}),
    ...(label !== null ? { label } : {}),
  });
  if (!edited) throw new Error(`No active banned-image record found for ${id}.`);
  console.log(`Edited banned image ${displayBannedImageId(edited)} in guild ${guildId}.`);
  console.log(`Reason: ${edited.reason}`);
  console.log(`Label: ${edited.label ?? "none"}`);
}

async function runImageAction(args: ParsedArgs): Promise<void> {
  const action = args.action as ImageAction | null;
  if (action === "add") return addImage(args);
  if (action === "test") return testImage(args);
  if (action === "remove") return removeImage(args);
  if (action === "edit") return editImage(args);
  throw new Error(`Unknown image action: ${args.action ?? "(missing)"}`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === null || args.options.help === true || args.command === "help") {
    console.log(usage());
    return;
  }
  if (args.command !== "image") throw new Error(`Unknown command: ${args.command}`);
  await runImageAction(args);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    console.error("");
    console.error(usage());
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDb().catch(() => {});
  });
