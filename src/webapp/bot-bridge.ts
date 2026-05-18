/**
 * Concrete `BotBridge` implementation built from the live Discord.js client.
 *
 * Read paths (channels/roles/status) hit the in-memory guild cache so the
 * webapp always shows fresh data without extra Discord REST calls. Write paths
 * (config, feature toggles, actions) go through the same repositories and
 * client methods the bot uses internally, then emit a typed `BotEvent` on the
 * shared EventEmitter so any SSE subscribers see the change immediately.
 */

import { EventEmitter } from "node:events";
import {
  ChannelType,
  type Client,
  type Guild,
  type GuildBasedChannel,
  type GuildMember,
  type PartialGuildMember,
  PermissionFlagsBits,
} from "discord.js";
import {
  getGuildFeatures,
  resolveFeatureEnabled,
  setGuildFeatureOverride,
} from "@/components/guild-features";
import { bus } from "@/core/bus";
import { getDb } from "@/core/db";
import { listFeatureCatalog } from "@/core/featureCatalog";
import { ErrResult, OkResult, type Result } from "@/core/result";
import { getAppeal, updateAppeal } from "@/db/repositories/appeals";
import { ensureGuild, getGuild, updateGuildPaths } from "@/db/repositories/guilds";
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
import {
  getRpgContentSnapshot,
  type RpgContentSnapshot,
  reloadRpgContent as reloadRuntimeRpgContent,
  saveRpgContent as saveRuntimeRpgContent,
} from "@/features/rpg/content/runtime";
import type {
  AppealSummary,
  BotBridge,
  BotEvent,
  CaseSummary,
  DiscordChannel,
  DiscordRole,
  FeatureSummary,
  ModerationBridgeAction,
} from "./bridge";

function channelTypeName(type: ChannelType): DiscordChannel["type"] {
  switch (type) {
    case ChannelType.GuildText:
      return "text";
    case ChannelType.GuildVoice:
      return "voice";
    case ChannelType.GuildCategory:
      return "category";
    case ChannelType.GuildForum:
      return "forum";
    case ChannelType.GuildAnnouncement:
      return "announcement";
    case ChannelType.GuildStageVoice:
      return "stage";
    case ChannelType.PublicThread:
    case ChannelType.PrivateThread:
    case ChannelType.AnnouncementThread:
      return "thread";
    default:
      return "other";
  }
}

function flattenPatch(prefix: string, value: Readonly<Record<string, unknown>> | undefined) {
  const paths: Record<string, unknown> = {};
  if (!value) return paths;
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) paths[`${prefix}.${key}`] = entry;
  }
  return paths;
}

async function updateComponentPaths(
  collection: string,
  guildId: string,
  paths: Record<string, unknown>,
): Promise<void> {
  const db = await getDb();
  await db.collection<{ _id: string }>(collection).updateOne(
    { _id: guildId },
    {
      $set: {
        ...paths,
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  );
}

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

function hasPermission(member: GuildMember, permission: bigint): boolean {
  return (
    member.permissions.has(permission) || member.permissions.has(PermissionFlagsBits.Administrator)
  );
}

interface GuildPermissionContext {
  readonly guild: Guild;
  readonly member: GuildMember;
}

async function requireGuildPermission(
  client: Client,
  guildId: string,
  actorId: string | null | undefined,
  permission: bigint,
): Promise<Result<GuildPermissionContext, Error>> {
  if (!actorId) return ErrResult(new Error("Authentication required."));
  const guild =
    client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId).catch(() => null));
  if (!guild) return ErrResult(new Error("Guild not in bot cache."));
  const member = await guild.members.fetch(actorId).catch(() => null);
  if (!member) return ErrResult(new Error("Actor is not in this server."));
  if (!hasPermission(member, permission)) {
    return ErrResult(new Error("Missing required Discord permission."));
  }
  return OkResult({ guild, member });
}

function mapActionEvent(event: {
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

export function createBridgeFromClient(client: Client): BotBridge {
  const events = new EventEmitter();
  events.setMaxListeners(64);

  const emit = (event: BotEvent): void => {
    events.emit("event", event);
  };

  bus.on("mod:action", (event) => {
    emit(mapActionEvent(event));
  });
  bus.on("appeal:decided", (event) => {
    emit({
      type: "appeal_decided",
      guildId: event.guildId,
      actorId: event.reviewerId,
      targetId: event.userId,
      detail: `Appeal ${event.status} for case #${event.caseId}`,
      timestamp: Date.now(),
    });
  });

  client.on("guildMemberAdd", (member: GuildMember) => {
    emit({
      type: "member_join",
      guildId: member.guild.id,
      targetId: member.id,
      detail: `${member.user.tag} joined`,
      timestamp: Date.now(),
    });
  });
  client.on("guildMemberRemove", (member: GuildMember | PartialGuildMember) => {
    emit({
      type: "member_leave",
      guildId: member.guild.id,
      targetId: member.id,
      detail: `${member.user.tag} left`,
      timestamp: Date.now(),
    });
  });

  return {
    events,

    async getChannels(guildId) {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return ErrResult(new Error("Guild not in bot cache."));
      const channels: DiscordChannel[] = [];
      for (const channel of guild.channels.cache.values()) {
        const gc = channel as GuildBasedChannel;
        channels.push({
          id: gc.id,
          name: gc.name ?? "",
          type: channelTypeName(gc.type),
          parentId: "parentId" in gc ? (gc.parentId as string | null) : null,
        });
      }
      channels.sort((a, b) => a.name.localeCompare(b.name));
      return OkResult(channels);
    },

    async getRoles(guildId) {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return ErrResult(new Error("Guild not in bot cache."));
      const roles: DiscordRole[] = [];
      for (const role of guild.roles.cache.values()) {
        if (role.id === guild.id) continue; // skip @everyone
        roles.push({
          id: role.id,
          name: role.name,
          color: role.color,
          position: role.position,
          managed: role.managed,
        });
      }
      roles.sort((a, b) => b.position - a.position);
      return OkResult(roles);
    },

    async getGuildConfig(guildId) {
      const ensured = await ensureGuild(guildId);
      if (ensured.isErr()) return ErrResult(ensured.error);
      return OkResult(ensured.unwrap() as unknown as Record<string, unknown>);
    },

    async getAdminState(guildId) {
      const [guildResult, featureResult] = await Promise.all([
        ensureGuild(guildId),
        getGuildFeatures(guildId),
      ]);
      if (guildResult.isErr()) return ErrResult(guildResult.error);
      if (featureResult.isErr()) return ErrResult(featureResult.error);
      const db = await getDb();
      const economy = await db
        .collection<{ _id: string }>("guild_economy")
        .findOne({ _id: guildId });
      return OkResult({
        guild: guildResult.unwrap(),
        features: featureResult.unwrap(),
        economy,
      });
    },

    async getGuildStatus(guildId) {
      const guild =
        client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId).catch(() => null));
      if (!guild) return ErrResult(new Error("Guild not in bot cache."));
      const featureState = await getGuildFeatures(guildId);
      if (featureState.isErr()) return ErrResult(featureState.error);
      const enabledFeatures = listFeatureCatalog()
        .filter((feature) => resolveFeatureEnabled(feature, featureState.unwrap().overrides))
        .map((feature) => feature.id);
      return OkResult({
        id: guild.id,
        name: guild.name,
        iconUrl: guild.iconURL({ size: 128 }),
        memberCount: guild.memberCount,
        enabledFeatures,
      });
    },

    async listFeatures(guildId) {
      const featureState = await getGuildFeatures(guildId);
      if (featureState.isErr()) return ErrResult(featureState.error);
      const features = listFeatureCatalog();
      const summaries: FeatureSummary[] = features.map((feature) => ({
        id: feature.id,
        hasConfig: feature.config !== undefined,
        enabled: resolveFeatureEnabled(feature, featureState.unwrap().overrides),
      }));
      return OkResult(summaries);
    },

    async saveChannels(guildId, slots) {
      const paths: Record<string, unknown> = {};
      for (const [slot, channelId] of Object.entries(slots)) {
        paths[`channels.core.${slot}`] = channelId ? { channelId } : null;
      }
      const result = await updateGuildPaths(guildId, paths, { upsert: true });
      if (result.isErr()) return ErrResult(result.error);
      emit({
        type: "config_changed",
        guildId,
        detail: `Updated channels: ${Object.keys(slots).join(", ")}`,
        timestamp: Date.now(),
      });
      return OkResult(undefined);
    },

    async saveModeration(guildId, patch) {
      const paths: Record<string, unknown> = {};
      if (patch.modLogChannelId !== undefined) {
        paths["channels.core.modlog"] = patch.modLogChannelId
          ? { channelId: patch.modLogChannelId }
          : null;
      }
      if (patch.appealsChannelId !== undefined) {
        paths["moderation.appealsChannelId"] = patch.appealsChannelId;
      }
      if (patch.quarantineRoleId !== undefined) {
        paths["moderation.quarantine.roleId"] = patch.quarantineRoleId;
        paths["moderation.quarantine.enabled"] = patch.quarantineRoleId !== null;
      }
      if (patch.verifiedRoleId !== undefined) {
        paths["moderation.verification.roleId"] = patch.verifiedRoleId;
        paths["moderation.verification.enabled"] = patch.verifiedRoleId !== null;
      }
      const result = await updateGuildPaths(guildId, paths, { upsert: true });
      if (result.isErr()) return ErrResult(result.error);
      emit({
        type: "config_changed",
        guildId,
        detail: "Updated moderation",
        timestamp: Date.now(),
      });
      return OkResult(undefined);
    },

    async saveAutomod(guildId, patch) {
      const paths = {
        ...flattenPatch("automod.linkSpam", patch.linkSpam),
        ...flattenPatch("automod.mentionSpam", patch.mentionSpam),
      };
      const result = await updateGuildPaths(guildId, paths, { upsert: true });
      if (result.isErr()) return ErrResult(result.error);
      emit({ type: "config_changed", guildId, detail: "Updated automod", timestamp: Date.now() });
      return OkResult(undefined);
    },

    async saveEconomy(guildId, patch) {
      const paths = {
        ...flattenPatch("daily", patch.daily),
        ...flattenPatch("work", patch.work),
        ...flattenPatch("sectors", patch.sectors),
      };
      try {
        await updateComponentPaths("guild_economy", guildId, paths);
      } catch (error) {
        return ErrResult(error instanceof Error ? error : new Error(String(error)));
      }
      emit({ type: "config_changed", guildId, detail: "Updated economy", timestamp: Date.now() });
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
      const guildResult = await getGuild(guildId);
      if (guildResult.isErr()) return ErrResult(guildResult.error);
      const current = guildResult.unwrap()?.roles?.[patch.roleId] ?? {};
      const next = {
        ...current,
        ...(patch.label !== undefined ? { label: patch.label } : {}),
        ...(patch.discordRoleId !== undefined ? { discordRoleId: patch.discordRoleId } : {}),
        ...(patch.reach !== undefined ? { reach: patch.reach } : {}),
        ...(patch.limits !== undefined ? { limits: patch.limits } : {}),
        updatedBy: patch.updatedBy ?? null,
        updatedAt: new Date().toISOString(),
      };
      const result = await updateGuildPaths(
        guildId,
        { [`roles.${patch.roleId}`]: next },
        { upsert: true },
      );
      if (result.isErr()) return ErrResult(result.error);
      emit({
        type: "config_changed",
        guildId,
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
            "all",
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

    async getRpgContent() {
      return OkResult(getRpgContentSnapshot() as unknown as Record<string, unknown>);
    },

    async saveRpgContent(snapshot) {
      const result = await saveRuntimeRpgContent(snapshot as unknown as RpgContentSnapshot);
      if (result.isErr()) return ErrResult(result.error);
      emit({
        type: "rpg_content_reloaded",
        guildId: "global",
        detail: "RPG content reloaded",
        timestamp: Date.now(),
      });
      return OkResult(result.unwrap() as unknown as Record<string, unknown>);
    },

    async reloadRpgContent() {
      const result = await reloadRuntimeRpgContent();
      if (result.isErr()) return ErrResult(result.error);
      emit({
        type: "rpg_content_reloaded",
        guildId: "global",
        detail: "RPG content reloaded",
        timestamp: Date.now(),
      });
      return OkResult(result.unwrap() as unknown as Record<string, unknown>);
    },

    async applyConfig(guildId, paths) {
      const result = await updateGuildPaths(guildId, paths, { upsert: true });
      if (result.isErr()) return ErrResult(result.error);
      emit({
        type: "config_changed",
        guildId,
        detail: `Updated: ${Object.keys(paths).join(", ")}`,
        timestamp: Date.now(),
      });
      return OkResult(undefined);
    },

    async toggleFeature(guildId, featureId, enabled) {
      const feature = listFeatureCatalog().find((entry) => entry.id === featureId);
      if (!feature) return ErrResult(new Error(`Unknown feature: ${featureId}`));
      const result = await setGuildFeatureOverride(guildId, featureId, enabled);
      if (result.isErr()) return ErrResult(result.error);
      emit({
        type: "config_changed",
        guildId,
        detail: `Feature ${featureId} ${enabled ? "enabled" : "disabled"}`,
        timestamp: Date.now(),
      });
      return OkResult(undefined);
    },

    async triggerAction(guildId, action) {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return ErrResult(new Error("Guild not in bot cache."));
      try {
        switch (action.type) {
          case "send_message": {
            const channel = await guild.channels.fetch(action.channelId);
            if (!channel?.isTextBased()) {
              return ErrResult(new Error("Channel is not text-based."));
            }
            await channel.send(action.content);
            return OkResult(undefined);
          }
          case "kick": {
            const member = await guild.members.fetch(action.userId);
            await member.kick(action.reason);
            return OkResult(undefined);
          }
          case "ban": {
            await guild.bans.create(action.userId, {
              reason: action.reason,
              deleteMessageSeconds: action.deleteMessageSeconds,
            });
            return OkResult(undefined);
          }
        }
      } catch (err) {
        return ErrResult(err instanceof Error ? err : new Error(String(err)));
      }
    },
  };
}
