import { ChannelType, type Client, type GuildBasedChannel } from "discord.js";
import { getGuildFeatures, resolveFeatureEnabled } from "@/components/guild-features";
import { getDb } from "@/core/db";
import { listFeatureCatalog } from "@/core/featureCatalog";
import { ErrResult, OkResult } from "@/core/result";
import { ensureGuild } from "@/db/repositories/guilds";
import { applyGuildConfigPaths, saveChannelSettings } from "@/features/adminPanels/configMutations";
import type { BotAction, BotBridge, DiscordChannel, DiscordRole } from "../bridge-types";
import type { BridgeEmit } from "./shared";

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

/** Creates guild/cache/config bridge methods backed by the live Discord client. */
export function createGuildBridge(
  client: Client,
  emit: BridgeEmit,
): Pick<
  BotBridge,
  | "getChannels"
  | "getRoles"
  | "getGuildConfig"
  | "getAdminState"
  | "getGuildStatus"
  | "saveChannels"
  | "applyConfig"
  | "triggerAction"
> {
  return {
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
        if (role.id === guild.id) continue;
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
      const guild = client.guilds.cache.get(guildId);
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

    async saveChannels(guildId, slots, actorId) {
      const result = await saveChannelSettings(guildId, slots);
      if (result.isErr()) return ErrResult(result.error);
      emit({
        type: "config_changed",
        guildId,
        actorId: actorId ?? undefined,
        detail: `Updated channels: ${Object.keys(slots).join(", ")}`,
        timestamp: Date.now(),
      });
      return OkResult(undefined);
    },

    async applyConfig(guildId, paths, actorId) {
      const result = await applyGuildConfigPaths(guildId, paths, { upsert: true });
      if (result.isErr()) return ErrResult(result.error);
      emit({
        type: "config_changed",
        guildId,
        actorId: actorId ?? undefined,
        detail: `Updated: ${Object.keys(paths).join(", ")}`,
        timestamp: Date.now(),
      });
      return OkResult(undefined);
    },

    async triggerAction(guildId, action: BotAction) {
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
