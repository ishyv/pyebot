import { type Client, PermissionFlagsBits } from "discord.js";
import { getDb } from "@/core/db";
import { ErrResult, OkResult } from "@/core/result";
import { getAppeal, updateAppeal } from "@/db/repositories/appeals";
import {
  saveModerationSettings,
  saveRolePolicySettings,
} from "@/features/adminPanels/configMutations";
import {
  ban,
  deleteCase as deleteModerationCase,
  editCase as editModerationCase,
  kick,
  mute,
  pardon,
  restrict,
  unban,
  warn,
} from "@/features/moderation/service";
import type {
  AppealSummary,
  BotBridge,
  BotEvent,
  CaseSummary,
  ModerationBridgeAction,
} from "../bridge-types";
import { type BridgeEmit, requireGuildPermission } from "./shared";

function moderationPermission(type: ModerationBridgeAction["type"]): bigint {
  switch (type) {
    case "ban":
    case "unban":
      return PermissionFlagsBits.BanMembers;
    case "kick":
      return PermissionFlagsBits.KickMembers;
    case "restrict":
      return PermissionFlagsBits.ManageRoles;
    case "warn":
    case "timeout":
      return PermissionFlagsBits.ModerateMembers;
  }
}

/** Maps moderation service events into the webapp bridge event stream. */
export function mapActionEvent(event: {
  guildId: string;
  userId: string;
  moderatorId: string;
  sanctionType: string;
  caseId: number;
}): BotEvent {
  return {
    type: "mod_action",
    guildId: event.guildId,
    actorId: event.moderatorId,
    targetId: event.userId,
    detail: `${event.sanctionType} case #${event.caseId}`,
    timestamp: Date.now(),
  };
}

async function loadCases(guildId: string): Promise<CaseSummary[]> {
  const db = await getDb();
  const docs = await db
    .collection<{ _id: string; sanction_history?: Record<string, unknown[]> }>("users")
    .find({ [`sanction_history.${guildId}`]: { $exists: true } })
    .toArray();
  const cases: CaseSummary[] = [];
  for (const doc of docs) {
    const entries = doc.sanction_history?.[guildId] ?? [];
    for (const entry of entries as Array<Record<string, unknown>>) {
      const caseId = Number(entry.caseId);
      if (!Number.isFinite(caseId)) continue;
      cases.push({
        userId: doc._id,
        caseId,
        type: String(entry.type ?? ""),
        description: String(entry.description ?? ""),
        date: typeof entry.date === "string" ? entry.date : undefined,
        moderatorId: typeof entry.moderatorId === "string" ? entry.moderatorId : undefined,
        source: typeof entry.source === "string" ? entry.source : undefined,
        evidenceSummary:
          typeof entry.evidenceSummary === "string" ? entry.evidenceSummary : undefined,
      });
    }
  }
  return cases.sort((a, b) => b.caseId - a.caseId);
}

async function loadAppeals(guildId: string): Promise<AppealSummary[]> {
  const db = await getDb();
  const docs = await db
    .collection<AppealSummary & { _id: string }>("appeals")
    .find({ guildId })
    .toArray();
  return docs
    .map((doc) => ({
      guildId: doc.guildId,
      caseId: doc.caseId,
      userId: doc.userId,
      userTag: doc.userTag,
      submittedAt: doc.submittedAt,
      reason: doc.reason,
      status: doc.status,
      threadId: doc.threadId,
    }))
    .sort((a, b) => b.caseId - a.caseId);
}

/** Creates moderation, case, appeal, and role-policy bridge methods. */
export function createModerationBridge(
  client: Client,
  emit: BridgeEmit,
): Pick<
  BotBridge,
  | "saveModeration"
  | "saveRolePolicy"
  | "listCases"
  | "editCase"
  | "deleteCase"
  | "listAppeals"
  | "resolveAppeal"
  | "runModerationAction"
> {
  return {
    async saveModeration(guildId, patch, actorId) {
      const result = await saveModerationSettings(guildId, patch);
      if (result.isErr()) return ErrResult(result.error);
      emit({
        type: "config_changed",
        guildId,
        actorId: actorId ?? undefined,
        detail: "Updated moderation",
        timestamp: Date.now(),
      });
      return OkResult(undefined);
    },

    async saveRolePolicy(guildId, patch) {
      const permission = await requireGuildPermission(
        client,
        guildId,
        patch.updatedBy,
        PermissionFlagsBits.ManageRoles,
      );
      if (permission.isErr()) return ErrResult(permission.error);
      const result = await saveRolePolicySettings(guildId, patch);
      if (result.isErr()) return ErrResult(result.error);
      emit({
        type: "config_changed",
        guildId,
        actorId: patch.updatedBy ?? undefined,
        detail: `Updated role policy ${patch.roleId}`,
        timestamp: Date.now(),
      });
      return OkResult(undefined);
    },

    async listCases(guildId) {
      try {
        return OkResult(await loadCases(guildId));
      } catch (error) {
        return ErrResult(error instanceof Error ? error : new Error(String(error)));
      }
    },

    async editCase(guildId, actorId, userId, caseId, description) {
      const permission = await requireGuildPermission(
        client,
        guildId,
        actorId,
        PermissionFlagsBits.ModerateMembers,
      );
      if (permission.isErr()) return ErrResult(permission.error);
      const result = await editModerationCase(userId, guildId, caseId, description);
      if (result.isErr()) return ErrResult(result.error);
      emit({
        type: "mod_action",
        guildId,
        targetId: userId,
        detail: `Edited case #${caseId}`,
        timestamp: Date.now(),
      });
      return OkResult(undefined);
    },

    async deleteCase(guildId, actorId, userId, caseId) {
      const permission = await requireGuildPermission(
        client,
        guildId,
        actorId,
        PermissionFlagsBits.ModerateMembers,
      );
      if (permission.isErr()) return ErrResult(permission.error);
      const result = await deleteModerationCase(userId, guildId, caseId);
      if (result.isErr()) return ErrResult(result.error);
      emit({
        type: "mod_action",
        guildId,
        targetId: userId,
        detail: `Deleted case #${caseId}`,
        timestamp: Date.now(),
      });
      return OkResult(undefined);
    },

    async listAppeals(guildId) {
      try {
        return OkResult(await loadAppeals(guildId));
      } catch (error) {
        return ErrResult(error instanceof Error ? error : new Error(String(error)));
      }
    },

    async resolveAppeal(guildId, caseId, reviewerId, status, note) {
      const permission = await requireGuildPermission(
        client,
        guildId,
        reviewerId,
        status === "approved"
          ? PermissionFlagsBits.BanMembers
          : PermissionFlagsBits.ModerateMembers,
      );
      if (permission.isErr()) return ErrResult(permission.error);
      const appeal = await getAppeal(guildId, caseId);
      if (!appeal) return ErrResult(new Error("Appeal not found."));
      const now = new Date().toISOString();
      const updateResult = await updateAppeal(guildId, caseId, {
        status,
        decision: {
          reviewerId,
          decidedAt: now,
          reasonCode: "other",
          note,
        },
      });
      if (updateResult.isErr()) return ErrResult(updateResult.error);

      const { guild } = permission.unwrap();
      if (status === "approved") {
        await pardon(guild, reviewerId, appeal.userId, appeal.userTag, note);
        await guild.bans.remove(appeal.userId, `Appeal approved: ${note}`).catch(() => null);
      }
      emit({
        type: "appeal_decided",
        guildId,
        actorId: reviewerId,
        targetId: appeal.userId,
        detail: `Appeal ${status} for case #${caseId}`,
        timestamp: Date.now(),
      });
      return OkResult(undefined);
    },

    async runModerationAction(guildId, action) {
      const permission = await requireGuildPermission(
        client,
        guildId,
        action.moderatorId,
        moderationPermission(action.type),
      );
      if (permission.isErr()) return ErrResult(permission.error);
      const { guild, member: moderator } = permission.unwrap();

      const targetMember =
        action.type === "ban" || action.type === "unban"
          ? null
          : await guild.members.fetch(action.targetUserId).catch(() => null);

      switch (action.type) {
        case "warn": {
          if (!targetMember) return ErrResult(new Error("Target member not found."));
          const result = await warn(guild, moderator, targetMember, action.reason);
          return result.isErr() ? ErrResult(result.error) : OkResult(undefined);
        }
        case "timeout": {
          if (!targetMember) return ErrResult(new Error("Target member not found."));
          const result = await mute(
            guild,
            moderator,
            targetMember,
            action.durationMs,
            action.reason,
          );
          return result.isErr() ? ErrResult(result.error) : OkResult(undefined);
        }
        case "kick": {
          if (!targetMember) return ErrResult(new Error("Target member not found."));
          const result = await kick(guild, moderator, targetMember, action.reason);
          return result.isErr() ? ErrResult(result.error) : OkResult(undefined);
        }
        case "restrict": {
          if (!targetMember) return ErrResult(new Error("Target member not found."));
          const result = await restrict(
            guild,
            moderator,
            targetMember,
            action.roleId,
            action.reason,
          );
          return result.isErr() ? ErrResult(result.error) : OkResult(undefined);
        }
        case "ban": {
          const target = await client.users.fetch(action.targetUserId);
          const result = await ban(guild, moderator, target, action.reason);
          return result.isErr() ? ErrResult(result.error) : OkResult(undefined);
        }
        case "unban": {
          const result = await unban(guild, moderator, action.targetUserId, action.reason);
          return result.isErr() ? ErrResult(result.error) : OkResult(undefined);
        }
      }
    },
  };
}
