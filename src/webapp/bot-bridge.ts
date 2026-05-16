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
import { ChannelType, type Client, type GuildBasedChannel } from "discord.js";
import { listFeatureCatalog } from "@/core/featureCatalog";
import { ErrResult, OkResult } from "@/core/result";
import { ensureGuild, updateGuildPaths } from "@/db/repositories/guilds";
import type { BotBridge, BotEvent, DiscordChannel, DiscordRole, FeatureSummary } from "./bridge";

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

export function createBridgeFromClient(client: Client): BotBridge {
  const events = new EventEmitter();
  events.setMaxListeners(64);

  const emit = (event: BotEvent): void => {
    events.emit("event", event);
  };

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

    async getGuildStatus(guildId) {
      const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return ErrResult(new Error("Guild not in bot cache."));
      const ensured = await ensureGuild(guildId);
      if (ensured.isErr()) return ErrResult(ensured.error);
      const config = ensured.unwrap();
      const enabledFeatures = Object.entries(config.features ?? {})
        .filter(([, on]) => on === true)
        .map(([id]) => id);
      return OkResult({
        id: guild.id,
        name: guild.name,
        iconUrl: guild.iconURL({ size: 128 }),
        memberCount: guild.memberCount,
        enabledFeatures,
      });
    },

    async listFeatures(guildId) {
      const ensured = await ensureGuild(guildId);
      if (ensured.isErr()) return ErrResult(ensured.error);
      const config = ensured.unwrap();
      const features = listFeatureCatalog();
      const summaries: FeatureSummary[] = features.map((feature) => ({
        id: feature.id,
        gate: feature.featureGate ?? null,
        hasConfig: feature.config !== undefined,
        enabled: feature.featureGate ? (config.features?.[feature.featureGate] ?? true) : true,
      }));
      return OkResult(summaries);
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
      const result = await updateGuildPaths(
        guildId,
        { [`features.${featureId}`]: enabled },
        { upsert: true },
      );
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
            if (!channel || !channel.isTextBased()) {
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
