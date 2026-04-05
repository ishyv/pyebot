/**
 * Moderation Service.
 *
 * Purpose: Execute moderation actions (ban, kick, mute, warn) and record sanctions.
 * Architecture: Plain exported async functions — no classes (except ModerationError).
 * Dependencies: Discord.js Guild/GuildMember API, MongoDB users collection ($push).
 *
 * Flow:
 *   ban/kick/mute/warn → validate target → execute Discord API → record sanction in DB
 *
 * Sanction records are appended to `user.sanction_history.<guildId>[]`.
 * getCases reads that array for a user+guild combination.
 *
 * Invariants:
 * - Cannot moderate the bot itself.
 * - Cannot moderate the executing moderator.
 * - Target must be a current guild member for kick/mute.
 * - For ban, non-member users can still be banned (Discord allows this).
 */

import type { Guild, GuildMember, User } from "discord.js";
import { PermissionFlagsBits, type PermissionResolvable } from "discord.js";
import { OkResult, ErrResult, type Result } from "@/core/result";
import { getDb } from "@/core/db";
import { userStore } from "@/db/repositories/users";
import { generateCaseId } from "@/utils/ids";
import { missingPermission } from "@/middleware/permissions";
import { createLogger } from "@/core/logger";
import type { SanctionHistoryEntry, SanctionType } from "@/db/schemas/user";

const log = createLogger("moderation");

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class ModerationError extends Error {
  constructor(
    public readonly code:
      | "CANNOT_MODERATE_SELF"
      | "CANNOT_MODERATE_BOT"
      | "MEMBER_NOT_FOUND"
      | "INSUFFICIENT_PERMISSIONS"
      | "DISCORD_API_FAILED"
      | "DB_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "ModerationError";
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModerationResult {
  readonly type: SanctionType;
  readonly targetId: string;
  readonly targetTag: string;
  readonly reason: string;
  readonly moderatorId: string;
  readonly caseId: string;
  readonly escalated?: boolean;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function pushSanction(
  userId: string,
  guildId: string,
  type: SanctionType,
  description: string,
  moderatorId: string,
): Promise<string> {
  const caseId = generateCaseId();
  await userStore.ensure(userId);
  const db = await getDb();
  await db.collection("users").updateOne(
    { _id: userId } as never,
    {
      $push: { [`sanction_history.${guildId}`]: { id: caseId, type, description, date: new Date().toISOString(), moderatorId } },
      $set: { updatedAt: new Date() },
    } as never,
  );
  return caseId;
}

function validateTarget(
  moderatorId: string,
  botId: string,
  targetId: string,
): ModerationError | null {
  if (targetId === moderatorId) {
    return new ModerationError("CANNOT_MODERATE_SELF", "You cannot moderate yourself");
  }
  if (targetId === botId) {
    return new ModerationError("CANNOT_MODERATE_BOT", "You cannot moderate the bot");
  }
  return null;
}

function checkBotPerms(guild: Guild, ...perms: PermissionResolvable[]): ModerationError | null {
  const bot = guild.members.me;
  if (!bot) return new ModerationError("INSUFFICIENT_PERMISSIONS", "Bot is not a guild member");
  const missing = missingPermission(bot, ...perms);
  if (missing) return new ModerationError("INSUFFICIENT_PERMISSIONS", `Bot missing permission: ${String(missing)}`);
  return null;
}

// ---------------------------------------------------------------------------
// ban
// ---------------------------------------------------------------------------

export async function ban(
  guild: Guild,
  moderator: GuildMember,
  target: User,
  reason: string,
): Promise<Result<ModerationResult, ModerationError>> {
  const validationErr = validateTarget(moderator.id, guild.client.user.id, target.id);
  if (validationErr) return ErrResult(validationErr);

  const botErr = checkBotPerms(guild, PermissionFlagsBits.BanMembers);
  if (botErr) return ErrResult(botErr);

  try {
    await guild.members.ban(target.id, { reason: `${reason} | by ${moderator.user.tag}` });
  } catch (err) {
    return ErrResult(new ModerationError("DISCORD_API_FAILED", `Ban failed: ${err instanceof Error ? err.message : String(err)}`));
  }

  const caseId = await pushSanction(target.id, guild.id, "BAN", reason, moderator.id).catch((err) => {
    log.error("Failed to record sanction in DB", err);
    return generateCaseId();
  });

  return OkResult({ type: "BAN", targetId: target.id, targetTag: target.tag, reason, moderatorId: moderator.id, caseId });
}

// ---------------------------------------------------------------------------
// kick
// ---------------------------------------------------------------------------

export async function kick(
  guild: Guild,
  moderator: GuildMember,
  target: GuildMember,
  reason: string,
): Promise<Result<ModerationResult, ModerationError>> {
  const validationErr = validateTarget(moderator.id, guild.client.user.id, target.id);
  if (validationErr) return ErrResult(validationErr);

  const botErr = checkBotPerms(guild, PermissionFlagsBits.KickMembers);
  if (botErr) return ErrResult(botErr);

  try {
    await target.kick(`${reason} | by ${moderator.user.tag}`);
  } catch (err) {
    return ErrResult(new ModerationError("DISCORD_API_FAILED", `Kick failed: ${err instanceof Error ? err.message : String(err)}`));
  }

  const caseId = await pushSanction(target.id, guild.id, "KICK", reason, moderator.id).catch((err) => {
    log.error("Failed to record sanction in DB", err);
    return generateCaseId();
  });

  return OkResult({ type: "KICK", targetId: target.id, targetTag: target.user.tag, reason, moderatorId: moderator.id, caseId });
}

// ---------------------------------------------------------------------------
// mute (Discord timeout)
// ---------------------------------------------------------------------------

const DURATION_MAP: Record<string, number> = {
  "10m": 10 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

export const MUTE_DURATION_CHOICES = Object.keys(DURATION_MAP);

export async function mute(
  guild: Guild,
  moderator: GuildMember,
  target: GuildMember,
  durationKey: string,
  reason: string,
): Promise<Result<ModerationResult, ModerationError>> {
  const validationErr = validateTarget(moderator.id, guild.client.user.id, target.id);
  if (validationErr) return ErrResult(validationErr);

  const durationMs = DURATION_MAP[durationKey];
  if (!durationMs) {
    return ErrResult(new ModerationError("DISCORD_API_FAILED", `Invalid duration: ${durationKey}`));
  }

  const botErr = checkBotPerms(guild, PermissionFlagsBits.ModerateMembers);
  if (botErr) return ErrResult(botErr);

  try {
    await target.timeout(durationMs, `${reason} | by ${moderator.user.tag}`);
  } catch (err) {
    return ErrResult(new ModerationError("DISCORD_API_FAILED", `Mute failed: ${err instanceof Error ? err.message : String(err)}`));
  }

  const caseId = await pushSanction(target.id, guild.id, "TIMEOUT", `${durationKey} — ${reason}`, moderator.id).catch((err) => {
    log.error("Failed to record sanction in DB", err);
    return generateCaseId();
  });

  return OkResult({ type: "TIMEOUT", targetId: target.id, targetTag: target.user.tag, reason, moderatorId: moderator.id, caseId });
}

// ---------------------------------------------------------------------------
// warn
// ---------------------------------------------------------------------------

export async function warn(
  guild: Guild,
  moderator: GuildMember,
  target: GuildMember,
  reason: string,
): Promise<Result<ModerationResult, ModerationError>> {
  const validationErr = validateTarget(moderator.id, guild.client.user.id, target.id);
  if (validationErr) return ErrResult(validationErr);

  const caseId = await pushSanction(target.id, guild.id, "WARN", reason, moderator.id).catch((err) => {
    log.error("Failed to record sanction in DB", err);
    return generateCaseId();
  });

  return OkResult({ type: "WARN", targetId: target.id, targetTag: target.user.tag, reason, moderatorId: moderator.id, caseId });
}

// ---------------------------------------------------------------------------
// getCases
// ---------------------------------------------------------------------------

export async function getCases(
  userId: string,
  guildId: string,
): Promise<Result<SanctionHistoryEntry[], ModerationError>> {
  const res = await userStore.get(userId);
  if (res.isErr()) return ErrResult(new ModerationError("DB_FAILED", res.error.message));
  const user = res.unwrap();
  const history = (user?.sanction_history?.[guildId] as SanctionHistoryEntry[] | undefined) ?? [];
  return OkResult(history);
}

// ---------------------------------------------------------------------------
// removeWarn
// ---------------------------------------------------------------------------

export async function removeWarn(
  userId: string,
  guildId: string,
  warnId: string,
): Promise<Result<boolean, ModerationError>> {
  try {
    const db = await getDb();
    const result = await db.collection("users").updateOne(
      { _id: userId } as never,
      { $pull: { [`sanction_history.${guildId}`]: { id: warnId, type: "WARN" } } } as never,
    );
    return OkResult(result.modifiedCount > 0);
  } catch (err) {
    return ErrResult(new ModerationError("DB_FAILED", `removeWarn failed: ${err instanceof Error ? err.message : String(err)}`));
  }
}

// ---------------------------------------------------------------------------
// clearWarns
// ---------------------------------------------------------------------------

export async function clearWarns(
  userId: string,
  guildId: string,
): Promise<Result<number, ModerationError>> {
  try {
    const res = await userStore.get(userId);
    if (res.isErr()) return ErrResult(new ModerationError("DB_FAILED", res.error.message));
    const user = res.unwrap();
    const history = (user?.sanction_history?.[guildId] as SanctionHistoryEntry[] | undefined) ?? [];
    const count = history.filter((e) => e.type === "WARN").length;

    const db = await getDb();
    await db.collection("users").updateOne(
      { _id: userId } as never,
      { $pull: { [`sanction_history.${guildId}`]: { type: "WARN" } } } as never,
    );
    return OkResult(count);
  } catch (err) {
    return ErrResult(new ModerationError("DB_FAILED", `clearWarns failed: ${err instanceof Error ? err.message : String(err)}`));
  }
}
