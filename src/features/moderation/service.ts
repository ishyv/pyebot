/**
 * Moderation Service.
 *
 * Purpose: Execute moderation actions (ban, kick, mute, warn, quarantine) and record sanctions.
 * Architecture: Plain exported async functions — no classes (except ModerationError).
 *
 * Flow:
 *   action → validate target → execute Discord API → record sanction in DB → post mod log → emit bus event
 *
 * Sanction records are appended to `user.sanction_history.<guildId>[]`.
 * Mod log posts to `guild.moderation.modLogChannelId` (best-effort, never blocks action).
 * Bus event `mod:action` is emitted for cross-feature listeners (e.g. escalation).
 */

import type { Guild, GuildMember, User } from "discord.js";
import { PermissionFlagsBits, type PermissionResolvable } from "discord.js";
import { User as UserEntity } from "@/components/entities";
import {
  UserModNotes,
  UserQuarantineRoles,
  UserSanctionHistory,
} from "@/components/moderation/sanctions";
import { bus } from "@/core/bus";
import { getDb } from "@/core/db";
import { ErrResult, OkResult, type Result } from "@/core/result";
import { getGuild } from "@/db/repositories/guilds";
import type { ModNote, SanctionHistoryEntry } from "@/db/schemas/user";
import type { Ctx } from "@/framework/types";
import { missingPermission } from "@/middleware/permissions";
import { msToHuman } from "@/utils/time";
import { sendModLog } from "./modlog";
import { modRoutes } from "./routes";
import type { SanctionType } from "./sanctions";

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
      | "DB_FAILED"
      | "NOT_CONFIGURED",
    message: string,
  ) {
    super(message);
    this.name = "ModerationError";
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SanctionEntry {
  readonly type: SanctionType;
  readonly description: string;
  readonly date: string;
  readonly caseId?: number;
  readonly moderatorId?: string;
  readonly source?: "manual" | "automod" | "appeal" | "escalation" | "system";
  readonly evidenceSummary?: string;
}

export interface ModerationResult {
  readonly type: SanctionType;
  readonly targetId: string;
  readonly targetTag: string;
  readonly reason: string;
  readonly moderatorId: string;
  readonly caseId: number;
  readonly escalated?: boolean;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Atomically increments nextCaseId on the guild document and returns the new ID. */
async function nextCaseId(guildId: string): Promise<number> {
  try {
    const db = await getDb();
    const result = await db
      .collection("guilds")
      .findOneAndUpdate({ _id: guildId } as never, { $inc: { nextCaseId: 1 } } as never, {
        returnDocument: "before",
        upsert: true,
      });
    return (result as { nextCaseId?: number } | null)?.nextCaseId ?? 1;
  } catch {
    return Date.now(); // fallback — guaranteed unique, just not sequential
  }
}

async function pushSanction(
  ctx: Ctx,
  userId: string,
  guildId: string,
  type: SanctionType,
  description: string,
  moderatorId: string,
  caseId: number,
  moderatorRoleIds: readonly string[] = [],
  metadata: { source?: SanctionEntry["source"]; evidenceSummary?: string } = {},
): Promise<void> {
  const entry: SanctionEntry & { moderatorRoleIds?: string[] } = {
    type,
    description,
    date: new Date().toISOString(),
    caseId,
    moderatorId,
    ...(moderatorRoleIds.length ? { moderatorRoleIds: [...moderatorRoleIds] } : {}),
    ...(metadata.source ? { source: metadata.source } : {}),
    ...(metadata.evidenceSummary ? { evidenceSummary: metadata.evidenceSummary } : {}),
  };
  await ctx.of(UserEntity, userId).update(UserSanctionHistory, (history) => ({
    [guildId]: [...(history[guildId] ?? []), entry],
  }));
}

/**
 * Records a system-owned AutoMod case after policy has authorized a sanction.
 * Discord side effects stay in AutoMod; this preserves user history and logs.
 */
export async function recordAutomodSystemCase(
  ctx: Ctx,
  guild: Guild,
  target: GuildMember,
  type: SanctionType,
  reason: string,
  evidenceSummary: string,
): Promise<Result<ModerationResult, ModerationError>> {
  const caseId = await nextCaseId(guild.id);
  const moderatorId = guild.client.user.id;
  await pushSanction(ctx, target.id, guild.id, type, reason, moderatorId, caseId, [], {
    source: "automod",
    evidenceSummary,
  }).catch(() => {});

  const modResult: ModerationResult = {
    type,
    targetId: target.id,
    targetTag: target.user.tag,
    reason,
    moderatorId,
    caseId,
  };

  await sendModLog(guild, modResult, {
    note: `AutoMod evidence: ${evidenceSummary.slice(0, 500)}`,
  });
  bus.emit({
    type: "mod:action",
    guildId: guild.id,
    userId: target.id,
    moderatorId,
    sanctionType: type,
    caseId,
  });
  return OkResult(modResult);
}

function moderationRoleSnapshot(member: GuildMember): string[] {
  return [
    ...member.roles.cache.filter((role) => !role.managed && role.id !== member.guild.id).keys(),
  ];
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
  if (missing)
    return new ModerationError(
      "INSUFFICIENT_PERMISSIONS",
      `Bot missing permission: ${String(missing)}`,
    );
  return null;
}

// ---------------------------------------------------------------------------
// ban
// ---------------------------------------------------------------------------

const TEMP_BAN_DURATION_MAP: Record<string, number> = {
  "1h": 1 * 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "3d": 3 * 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

export const TEMP_BAN_DURATION_CHOICES = Object.keys(TEMP_BAN_DURATION_MAP);

export async function ban(
  ctx: Ctx,
  guild: Guild,
  moderator: GuildMember,
  target: User,
  reason: string,
  duration?: string, // key from TEMP_BAN_DURATION_MAP; omit for permanent
): Promise<Result<ModerationResult, ModerationError>> {
  const validationErr = validateTarget(moderator.id, guild.client.user.id, target.id);
  if (validationErr) return ErrResult(validationErr);

  const botErr = checkBotPerms(guild, PermissionFlagsBits.BanMembers);
  if (botErr) return ErrResult(botErr);

  try {
    await guild.members.ban(target.id, { reason: `${reason} | by ${moderator.user.tag}` });
  } catch (err) {
    return ErrResult(
      new ModerationError(
        "DISCORD_API_FAILED",
        `Ban failed: ${err instanceof Error ? err.message : String(err)}`,
      ),
    );
  }

  const caseId = await nextCaseId(guild.id);
  const durationLabel = duration ? ` (${duration})` : "";
  await pushSanction(
    ctx,
    target.id,
    guild.id,
    "BAN",
    `${reason}${durationLabel}`,
    moderator.id,
    caseId,
    moderationRoleSnapshot(moderator),
  ).catch(() => {});

  // Schedule auto-unban if duration provided
  if (duration && TEMP_BAN_DURATION_MAP[duration]) {
    const { createTempBan } = await import("@/db/repositories/tempBans");
    await createTempBan({
      guildId: guild.id,
      userId: target.id,
      reason,
      moderatorId: moderator.id,
      bannedAt: new Date(),
      unbanAt: new Date(Date.now() + TEMP_BAN_DURATION_MAP[duration]),
    }).catch(() => {});
  }

  const modResult: ModerationResult = {
    type: "BAN",
    targetId: target.id,
    targetTag: target.tag,
    reason,
    moderatorId: moderator.id,
    caseId,
  };

  await sendModLog(guild, modResult, duration ? { duration } : undefined);
  bus.emit({
    type: "mod:action",
    guildId: guild.id,
    userId: target.id,
    moderatorId: moderator.id,
    sanctionType: "BAN",
    caseId,
  });

  // Best-effort appeal DM
  sendBanDm(guild, target, reason, caseId).catch(() => {});

  return OkResult(modResult);
}

async function sendBanDm(
  guild: Guild,
  target: User,
  reason: string,
  caseId: number,
): Promise<void> {
  try {
    const guildResult = await getGuild(guild.id);
    if (guildResult.isErr()) return;
    const appealsChannelId = guildResult.unwrap()?.moderation.appealsChannelId;

    const msg = `You have been banned from **${guild.name}**.\n**Reason:** ${reason}`;
    if (appealsChannelId) {
      const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import("discord.js");
      const row = new ActionRowBuilder<InstanceType<typeof ButtonBuilder>>().addComponents(
        modRoutes.appeal.button(
          { guildId: guild.id, caseId },
          { label: "Appeal Ban", style: ButtonStyle.Secondary },
        ),
      );
      await target.send({ content: msg, components: [row] });
    } else {
      await target.send(msg);
    }
  } catch {
    /* DMs may be closed */
  }
}

// ---------------------------------------------------------------------------
// kick
// ---------------------------------------------------------------------------

export async function kick(
  ctx: Ctx,
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
    return ErrResult(
      new ModerationError(
        "DISCORD_API_FAILED",
        `Kick failed: ${err instanceof Error ? err.message : String(err)}`,
      ),
    );
  }

  const caseId = await nextCaseId(guild.id);
  await pushSanction(
    ctx,
    target.id,
    guild.id,
    "KICK",
    reason,
    moderator.id,
    caseId,
    moderationRoleSnapshot(moderator),
  ).catch(() => {});

  const modResult: ModerationResult = {
    type: "KICK",
    targetId: target.id,
    targetTag: target.user.tag,
    reason,
    moderatorId: moderator.id,
    caseId,
  };

  await sendModLog(guild, modResult);
  bus.emit({
    type: "mod:action",
    guildId: guild.id,
    userId: target.id,
    moderatorId: moderator.id,
    sanctionType: "KICK",
    caseId,
  });

  return OkResult(modResult);
}

// ---------------------------------------------------------------------------
// mute (Discord timeout)
// ---------------------------------------------------------------------------

export const DURATION_MAP: Record<string, number> = {
  "10m": 10 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

export const MUTE_DURATION_CHOICES = Object.keys(DURATION_MAP);

export async function mute(
  ctx: Ctx,
  guild: Guild,
  moderator: GuildMember,
  target: GuildMember,
  durationMs: number,
  reason: string,
): Promise<Result<ModerationResult, ModerationError>> {
  const validationErr = validateTarget(moderator.id, guild.client.user.id, target.id);
  if (validationErr) return ErrResult(validationErr);

  const botErr = checkBotPerms(guild, PermissionFlagsBits.ModerateMembers);
  if (botErr) return ErrResult(botErr);

  try {
    await target.timeout(durationMs, `${reason} | by ${moderator.user.tag}`);
  } catch (err) {
    return ErrResult(
      new ModerationError(
        "DISCORD_API_FAILED",
        `Mute failed: ${err instanceof Error ? err.message : String(err)}`,
      ),
    );
  }

  const caseId = await nextCaseId(guild.id);
  await pushSanction(
    ctx,
    target.id,
    guild.id,
    "TIMEOUT",
    `${msToHuman(durationMs)} — ${reason}`,
    moderator.id,
    caseId,
    moderationRoleSnapshot(moderator),
  ).catch(() => {});

  const modResult: ModerationResult = {
    type: "TIMEOUT",
    targetId: target.id,
    targetTag: target.user.tag,
    reason,
    moderatorId: moderator.id,
    caseId,
  };

  await sendModLog(guild, modResult, { duration: msToHuman(durationMs) });
  bus.emit({
    type: "mod:action",
    guildId: guild.id,
    userId: target.id,
    moderatorId: moderator.id,
    sanctionType: "TIMEOUT",
    caseId,
  });

  return OkResult(modResult);
}

// ---------------------------------------------------------------------------
// warn
// ---------------------------------------------------------------------------

export async function warn(
  ctx: Ctx,
  guild: Guild,
  moderator: GuildMember,
  target: GuildMember,
  reason: string,
): Promise<Result<ModerationResult, ModerationError>> {
  const validationErr = validateTarget(moderator.id, guild.client.user.id, target.id);
  if (validationErr) return ErrResult(validationErr);

  const caseId = await nextCaseId(guild.id);
  await pushSanction(
    ctx,
    target.id,
    guild.id,
    "WARN",
    reason,
    moderator.id,
    caseId,
    moderationRoleSnapshot(moderator),
  ).catch(() => {});

  const modResult: ModerationResult = {
    type: "WARN",
    targetId: target.id,
    targetTag: target.user.tag,
    reason,
    moderatorId: moderator.id,
    caseId,
  };

  await sendModLog(guild, modResult);
  bus.emit({
    type: "mod:action",
    guildId: guild.id,
    userId: target.id,
    moderatorId: moderator.id,
    sanctionType: "WARN",
    caseId,
  });

  // Check escalation thresholds after warn
  const escalated = await checkEscalation(ctx, guild, target, moderator).catch(() => false);

  return OkResult({ ...modResult, escalated });
}

// ---------------------------------------------------------------------------
// checkEscalation (called after warn)
// ---------------------------------------------------------------------------

async function checkEscalation(
  ctx: Ctx,
  guild: Guild,
  target: GuildMember,
  moderator: GuildMember,
): Promise<boolean> {
  const guildResult = await getGuild(guild.id);
  if (guildResult.isErr()) return false;
  const config = guildResult.unwrap()?.moderation.escalation;
  if (!config?.enabled || config.thresholds.length === 0) return false;

  const casesResult = await getCases(ctx, target.id, guild.id);
  if (casesResult.isErr()) return false;

  const warnCount = casesResult.unwrap().filter((c) => c.type === "WARN").length;

  // Find the highest matching threshold
  const matching = config.thresholds
    .filter((t) => t.warnCount === warnCount)
    .sort((a, b) => b.warnCount - a.warnCount);

  const threshold = matching[0];
  if (!threshold) return false;

  const escalationReason = `Auto-escalation: reached ${warnCount} warning${warnCount === 1 ? "" : "s"}`;

  if (threshold.action === "timeout" && threshold.durationKey) {
    const durationMs = DURATION_MAP[threshold.durationKey ?? ""] ?? DURATION_MAP["1h"];
    await mute(ctx, guild, moderator, target, durationMs, escalationReason).catch(() => {});
    return true;
  } else if (threshold.action === "kick") {
    await kick(ctx, guild, moderator, target, escalationReason).catch(() => {});
    return true;
  } else if (threshold.action === "ban") {
    await ban(ctx, guild, moderator, target.user, escalationReason).catch(() => {});
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// restrict
// ---------------------------------------------------------------------------

export async function restrict(
  ctx: Ctx,
  guild: Guild,
  moderator: GuildMember,
  target: GuildMember,
  roleId: string,
  reason: string,
): Promise<Result<ModerationResult, ModerationError>> {
  const botErr = checkBotPerms(guild, PermissionFlagsBits.ManageRoles);
  if (botErr) return ErrResult(botErr);

  const validationErr = validateTarget(moderator.id, guild.client.user.id, target.id);
  if (validationErr) return ErrResult(validationErr);

  try {
    await target.roles.add(roleId, reason);
  } catch (err) {
    return ErrResult(
      new ModerationError(
        "DISCORD_API_FAILED",
        `Restrict failed: ${err instanceof Error ? err.message : String(err)}`,
      ),
    );
  }

  const caseId = await nextCaseId(guild.id);
  await pushSanction(
    ctx,
    target.id,
    guild.id,
    "RESTRICT",
    reason,
    moderator.id,
    caseId,
    moderationRoleSnapshot(moderator),
  ).catch(() => {});
  const modResult: ModerationResult = {
    type: "RESTRICT",
    targetId: target.id,
    targetTag: target.user.tag,
    reason,
    moderatorId: moderator.id,
    caseId,
  };
  await sendModLog(guild, modResult);
  bus.emit({
    type: "mod:action",
    guildId: guild.id,
    userId: target.id,
    moderatorId: moderator.id,
    sanctionType: "RESTRICT",
    caseId,
  });
  return OkResult(modResult);
}

// ---------------------------------------------------------------------------
// getCases
// ---------------------------------------------------------------------------

export async function getCases(
  ctx: Ctx,
  userId: string,
  guildId: string,
): Promise<Result<SanctionHistoryEntry[], ModerationError>> {
  try {
    const history = await ctx.of(UserEntity, userId).get(UserSanctionHistory);
    return OkResult(history[guildId] ?? []);
  } catch (err) {
    return ErrResult(new ModerationError("DB_FAILED", String(err)));
  }
}

// ---------------------------------------------------------------------------
// getCaseById — raw lookup for a guild case number
// ---------------------------------------------------------------------------

export async function getCaseById(
  guildId: string,
  caseId: number,
): Promise<Result<{ entry: SanctionHistoryEntry; userId: string } | null, ModerationError>> {
  try {
    const db = await getDb();
    // This is the one moderation lookup that starts from a guild case number,
    // not a user id. The current entity API has no typed nested-array filter,
    // so keep this narrow raw query instead of scanning every user.
    const doc = await db.collection("users").findOne({
      [`sanction_history.${guildId}`]: { $elemMatch: { caseId } },
    } as never);

    if (!doc) return OkResult(null);
    const history = UserSanctionHistory.schema.parse(
      (doc as Record<string, unknown>).sanction_history ?? {},
    );
    const entries = history?.[guildId] ?? [];
    const entry = entries.find((e) => e.caseId === caseId) ?? null;
    return OkResult(entry ? { entry, userId: String((doc as { _id: unknown })._id) } : null);
  } catch (err) {
    return ErrResult(new ModerationError("DB_FAILED", String(err)));
  }
}

// ---------------------------------------------------------------------------
// editCase
// ---------------------------------------------------------------------------

export async function editCase(
  ctx: Ctx,
  userId: string,
  guildId: string,
  caseId: number,
  newDescription: string,
): Promise<Result<void, ModerationError>> {
  try {
    const history = await ctx.of(UserEntity, userId).get(UserSanctionHistory);
    const guildHistory = history[guildId] ?? [];
    let found = false;
    const updated = guildHistory.map((entry) => {
      if (entry.caseId !== caseId) return entry;
      found = true;
      return { ...entry, description: newDescription };
    });
    if (!found) {
      return ErrResult(new ModerationError("DB_FAILED", "Case not found"));
    }
    await ctx.of(UserEntity, userId).update(UserSanctionHistory, { [guildId]: updated });
    return OkResult(undefined);
  } catch (err) {
    return ErrResult(new ModerationError("DB_FAILED", String(err)));
  }
}

// ---------------------------------------------------------------------------
// deleteCase
// ---------------------------------------------------------------------------

export async function deleteCase(
  ctx: Ctx,
  userId: string,
  guildId: string,
  caseId: number,
): Promise<Result<void, ModerationError>> {
  try {
    const history = await ctx.of(UserEntity, userId).get(UserSanctionHistory);
    const guildHistory = history[guildId] ?? [];
    await ctx.of(UserEntity, userId).update(UserSanctionHistory, {
      [guildId]: guildHistory.filter((entry) => entry.caseId !== caseId),
    });
    return OkResult(undefined);
  } catch (err) {
    return ErrResult(new ModerationError("DB_FAILED", String(err)));
  }
}

// ---------------------------------------------------------------------------
// removeWarn
// ---------------------------------------------------------------------------

export async function removeWarn(
  ctx: Ctx,
  userId: string,
  guildId: string,
  warnId: string,
): Promise<Result<boolean, ModerationError>> {
  try {
    const caseId = parseInt(warnId, 10);
    const history = await ctx.of(UserEntity, userId).get(UserSanctionHistory);
    const guildHistory = history[guildId] ?? [];
    const updated = guildHistory.filter(
      (entry) => !(entry.caseId === caseId && entry.type === "WARN"),
    );
    if (updated.length === guildHistory.length) return OkResult(false);
    await ctx.of(UserEntity, userId).update(UserSanctionHistory, { [guildId]: updated });
    return OkResult(true);
  } catch (err) {
    return ErrResult(
      new ModerationError(
        "DB_FAILED",
        `removeWarn failed: ${err instanceof Error ? err.message : String(err)}`,
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Mod notes
// ---------------------------------------------------------------------------

export async function addNote(
  ctx: Ctx,
  userId: string,
  guildId: string,
  note: string,
  moderatorId: string,
): Promise<Result<void, ModerationError>> {
  try {
    await ctx.of(UserEntity, userId).update(UserModNotes, (notes) => ({
      [guildId]: [
        ...(notes[guildId] ?? []),
        { note, moderatorId, createdAt: new Date().toISOString() },
      ],
    }));
    return OkResult(undefined);
  } catch (err) {
    return ErrResult(new ModerationError("DB_FAILED", String(err)));
  }
}

export async function getNotes(
  ctx: Ctx,
  userId: string,
  guildId: string,
): Promise<Result<ModNote[], ModerationError>> {
  try {
    const notes = await ctx.of(UserEntity, userId).get(UserModNotes);
    return OkResult(notes[guildId] ?? []);
  } catch (err) {
    return ErrResult(new ModerationError("DB_FAILED", String(err)));
  }
}

export async function deleteNote(
  ctx: Ctx,
  userId: string,
  guildId: string,
  index: number,
): Promise<Result<void, ModerationError>> {
  try {
    const notesResult = await getNotes(ctx, userId, guildId);
    if (notesResult.isErr()) return ErrResult(notesResult.error);
    const notes = [...notesResult.unwrap()];
    if (index < 0 || index >= notes.length) {
      return ErrResult(new ModerationError("DB_FAILED", "Note index out of range"));
    }
    notes.splice(index, 1);
    await ctx.of(UserEntity, userId).update(UserModNotes, { [guildId]: notes });
    return OkResult(undefined);
  } catch (err) {
    return ErrResult(new ModerationError("DB_FAILED", String(err)));
  }
}

// ---------------------------------------------------------------------------
// Quarantine
// ---------------------------------------------------------------------------

export async function quarantine(
  ctx: Ctx,
  guild: Guild,
  moderator: GuildMember,
  target: GuildMember,
  reason: string,
): Promise<Result<ModerationResult, ModerationError>> {
  const validationErr = validateTarget(moderator.id, guild.client.user.id, target.id);
  if (validationErr) return ErrResult(validationErr);

  const guildResult = await getGuild(guild.id);
  if (guildResult.isErr())
    return ErrResult(new ModerationError("DB_FAILED", "Could not load guild config"));
  const quarantineConfig = guildResult.unwrap()?.moderation.quarantine;

  if (!quarantineConfig?.enabled || !quarantineConfig.roleId) {
    return ErrResult(
      new ModerationError(
        "NOT_CONFIGURED",
        "Quarantine is not configured. Use /modset quarantine to set it up.",
      ),
    );
  }

  // Save current roles before stripping
  const currentRoleIds = [
    ...target.roles.cache.filter((r) => !r.managed && r.id !== guild.id).keys(),
  ];
  await ctx
    .of(UserEntity, target.id)
    .update(UserQuarantineRoles, { [guild.id]: currentRoleIds })
    .catch(() => {});

  try {
    // Remove all non-managed roles and apply quarantine role
    await target.roles.set([quarantineConfig.roleId], `Quarantine: ${reason}`);
  } catch (err) {
    return ErrResult(
      new ModerationError(
        "DISCORD_API_FAILED",
        `Quarantine failed: ${err instanceof Error ? err.message : String(err)}`,
      ),
    );
  }

  const caseId = await nextCaseId(guild.id);
  await pushSanction(
    ctx,
    target.id,
    guild.id,
    "RESTRICT",
    reason,
    moderator.id,
    caseId,
    moderationRoleSnapshot(moderator),
  ).catch(() => {});

  const modResult: ModerationResult = {
    type: "RESTRICT",
    targetId: target.id,
    targetTag: target.user.tag,
    reason,
    moderatorId: moderator.id,
    caseId,
  };

  await sendModLog(guild, modResult);
  bus.emit({
    type: "mod:action",
    guildId: guild.id,
    userId: target.id,
    moderatorId: moderator.id,
    sanctionType: "RESTRICT",
    caseId,
  });

  return OkResult(modResult);
}

export async function release(
  ctx: Ctx,
  guild: Guild,
  moderator: GuildMember,
  target: GuildMember,
): Promise<Result<{ restoredRoles: number }, ModerationError>> {
  const guildResult = await getGuild(guild.id);
  if (guildResult.isErr())
    return ErrResult(new ModerationError("DB_FAILED", "Could not load guild config"));
  const quarantineConfig = guildResult.unwrap()?.moderation.quarantine;

  if (!quarantineConfig?.enabled || !quarantineConfig.roleId) {
    return ErrResult(new ModerationError("NOT_CONFIGURED", "Quarantine is not configured."));
  }

  let savedRoles: string[];
  try {
    const roles = await ctx.of(UserEntity, target.id).get(UserQuarantineRoles);
    savedRoles = roles[guild.id] ?? [];
  } catch {
    return ErrResult(new ModerationError("DB_FAILED", "Could not load saved roles to restore"));
  }

  try {
    await target.roles.set(savedRoles, `Released from quarantine by ${moderator.user.tag}`);
  } catch (err) {
    return ErrResult(
      new ModerationError(
        "DISCORD_API_FAILED",
        `Release failed: ${err instanceof Error ? err.message : String(err)}`,
      ),
    );
  }

  await ctx
    .of(UserEntity, target.id)
    .update(UserQuarantineRoles, { [guild.id]: [] })
    .catch(() => {});

  return OkResult({ restoredRoles: savedRoles.length });
}

// ---------------------------------------------------------------------------
// unban
// ---------------------------------------------------------------------------

export async function unban(
  ctx: Ctx,
  guild: Guild,
  moderator: GuildMember,
  targetId: string,
  reason: string,
  targetTag?: string,
): Promise<Result<ModerationResult, ModerationError>> {
  const validationErr = validateTarget(moderator.id, guild.client.user.id, targetId);
  if (validationErr) return ErrResult(validationErr);

  const botErr = checkBotPerms(guild, PermissionFlagsBits.BanMembers);
  if (botErr) return ErrResult(botErr);

  try {
    await guild.members.unban(targetId, reason);
  } catch (err) {
    return ErrResult(
      new ModerationError(
        "DISCORD_API_FAILED",
        `Unban failed: ${err instanceof Error ? err.message : String(err)}`,
      ),
    );
  }

  const caseId = await nextCaseId(guild.id);
  await pushSanction(ctx, targetId, guild.id, "PARDON", reason, moderator.id, caseId).catch(
    () => {},
  );
  const modResult: ModerationResult = {
    type: "PARDON",
    targetId,
    targetTag: targetTag ?? targetId,
    reason,
    moderatorId: moderator.id,
    caseId,
  };
  await sendModLog(guild, modResult);
  bus.emit({
    type: "mod:action",
    guildId: guild.id,
    userId: targetId,
    moderatorId: moderator.id,
    sanctionType: "PARDON",
    caseId,
  });
  return OkResult(modResult);
}

// ---------------------------------------------------------------------------
// clearWarns
// ---------------------------------------------------------------------------

export async function clearWarns(
  ctx: Ctx,
  userId: string,
  guildId: string,
): Promise<Result<number, ModerationError>> {
  try {
    const history = await ctx.of(UserEntity, userId).get(UserSanctionHistory);
    const guildHistory = history[guildId] ?? [];
    const updated = guildHistory.filter((entry) => entry.type !== "WARN");
    const count = guildHistory.length - updated.length;
    await ctx.of(UserEntity, userId).update(UserSanctionHistory, { [guildId]: updated });
    return OkResult(count);
  } catch (err) {
    return ErrResult(
      new ModerationError(
        "DB_FAILED",
        `clearWarns failed: ${err instanceof Error ? err.message : String(err)}`,
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// pardon (appeal approval)
// ---------------------------------------------------------------------------

/**
 * Records a PARDON sanction entry for a user. Called by the appeals workflow
 * when a moderator approves an appeal. Does not unban — the caller handles
 * the Discord API unban so it can remain non-fatal and isolated from the
 * sanction record write.
 *
 * A new sequential case ID is issued for the PARDON entry itself so each
 * case is unique and auditable independently of the original ban case.
 */
export async function pardon(
  ctx: Ctx,
  guild: Guild,
  reviewerId: string,
  targetId: string,
  targetTag: string,
  reason: string,
): Promise<Result<ModerationResult, ModerationError>> {
  const caseId = await nextCaseId(guild.id);

  await pushSanction(ctx, targetId, guild.id, "PARDON", reason, reviewerId, caseId, [], {
    source: "appeal",
  });

  const modResult: ModerationResult = {
    type: "PARDON",
    targetId,
    targetTag,
    reason,
    moderatorId: reviewerId,
    caseId,
  };

  await sendModLog(guild, modResult);
  bus.emit({
    type: "mod:action",
    guildId: guild.id,
    userId: targetId,
    moderatorId: reviewerId,
    sanctionType: "PARDON",
    caseId,
  });

  return OkResult(modResult);
}
