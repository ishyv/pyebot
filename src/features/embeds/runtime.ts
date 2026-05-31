/**
 * Runtime loops for admin-authored embeds.
 *
 * Sticky embeds react to raw Discord `messageCreate` events and repost a
 * configured message at the bottom of a channel. Scheduled embeds run from a
 * periodic sweep. Both paths share the same persisted `EmbedConfig` records but
 * keep side effects injectable so repost/schedule rules remain unit-testable.
 *
 * Invariants:
 * - Sticky cache stores only config IDs, not full configs, so edits are visible
 *   after the next fetch or invalidation.
 * - Repost state is persisted after send; if persistence fails the cache entry
 *   is dropped to avoid trusting stale message IDs.
 * - Scheduled sends are best-effort per config; one bad channel must not stop
 *   the rest of the sweep.
 */
import type { Client, Guild, Message, TextBasedChannel } from "discord.js";
import { createLogger, type Logger } from "@/core/logger";
import {
  findDueScheduled,
  findStickyForChannel,
  getEmbedConfigById,
  patchEmbedConfig,
} from "@/db/repositories/embeds";
import type { EmbedConfig } from "@/db/schemas/embed-config";
import { EMBED_STICKY_DEBOUNCE_MS } from "./config";
import { sendEmbed as sendConfiguredEmbed } from "./service";

type StickyCacheEntry = { configId: string | null };

/** External effects used by sticky-message runtime; injectable so repost rules stay testable. */
export interface StickyRuntimeDeps {
  findStickyForChannel(
    guildId: string,
    channelId: string,
  ): PromiseLike<{ isErr(): boolean; unwrap(): EmbedConfig | null }>;
  getEmbedConfigById(id: string): PromiseLike<{ isErr(): boolean; unwrap(): EmbedConfig | null }>;
  patchEmbedConfig(id: string, patch: Partial<EmbedConfig>): PromiseLike<{ isErr(): boolean }>;
  sendEmbed(
    config: EmbedConfig,
    channel: TextBasedChannel,
    guild: Guild,
  ): PromiseLike<{ id: string }>;
  log: Pick<Logger, "warn" | "error">;
  now(): number;
}

/** External effects used by the scheduled sweep runtime. */
export interface ScheduledRuntimeDeps {
  findDueScheduled(): PromiseLike<{ isErr(): boolean; unwrap(): EmbedConfig[]; error?: Error }>;
  patchEmbedConfig(id: string, patch: Partial<EmbedConfig>): PromiseLike<{ isErr(): boolean }>;
  sendEmbed(
    config: EmbedConfig,
    channel: TextBasedChannel,
    guild: Guild,
  ): PromiseLike<{ id: string }>;
  log: Pick<Logger, "warn" | "error">;
  now(): Date;
}

function cacheKey(guildId: string, channelId: string): string {
  return `${guildId}:${channelId}`;
}

function defaultStickyDeps(): StickyRuntimeDeps {
  const log = createLogger("embeds:sticky");
  return {
    findStickyForChannel,
    getEmbedConfigById,
    patchEmbedConfig,
    sendEmbed: sendConfiguredEmbed,
    log,
    now: () => Date.now(),
  };
}

function defaultScheduledDeps(): ScheduledRuntimeDeps {
  const log = createLogger("embeds:schedule");
  return {
    findDueScheduled,
    patchEmbedConfig,
    sendEmbed: sendConfiguredEmbed,
    log,
    now: () => new Date(),
  };
}

/** Owns sticky-message cache and repost behavior for Discord messageCreate events. */
export function createStickyEmbedRuntime(deps: StickyRuntimeDeps = defaultStickyDeps()) {
  const cache = new Map<string, StickyCacheEntry>();

  return {
    invalidate(guildId: string, channelId: string): void {
      cache.delete(cacheKey(guildId, channelId));
    },

    async handleMessage(message: Message): Promise<void> {
      try {
        if (message.author.bot || !message.guildId || !message.guild) return;

        const key = cacheKey(message.guildId, message.channelId);
        let cached = cache.get(key);
        let config: EmbedConfig | null = null;

        if (!cached) {
          // WHY: cache misses are keyed by channel, because a channel can have
          // at most one sticky config. Cache the absence too to avoid querying
          // Mongo for every normal message in non-sticky channels.
          const stickyRes = await deps.findStickyForChannel(message.guildId, message.channelId);
          if (stickyRes.isErr()) return;
          config = stickyRes.unwrap();
          cached = { configId: config?._id ?? null };
          cache.set(key, cached);
        }

        if (!cached.configId) return;

        if (!config) {
          const configRes = await deps.getEmbedConfigById(cached.configId);
          if (configRes.isErr()) {
            cache.delete(key);
            return;
          }
          config = configRes.unwrap();
        }

        if (!config?.stickyEnabled || config.channelId !== message.channelId) {
          cache.delete(key);
          return;
        }

        if (
          config.stickyLastResendAt &&
          deps.now() - config.stickyLastResendAt.getTime() < EMBED_STICKY_DEBOUNCE_MS
        ) {
          return;
        }

        if (config.stickyMessageId) {
          // RISK: deletion can fail for missing access or already-deleted
          // messages. Reposting should still continue; the worst case is one
          // stale sticky message left behind.
          await message.channel.messages.delete(config.stickyMessageId).catch(() => null);
        }

        const sent = await deps.sendEmbed(config, message.channel, message.guild);
        const patchRes = await deps.patchEmbedConfig(config._id, {
          stickyMessageId: sent.id,
          stickyLastResendAt: new Date(deps.now()),
        });
        if (patchRes.isErr()) {
          deps.log.warn("Failed to persist sticky message state", { id: config._id });
          cache.delete(key);
          return;
        }

        cache.set(key, { configId: config._id });
      } catch (error) {
        deps.log.error("Sticky embed repost failed", error);
      }
    },
  };
}

/** Runs the recurring scheduled-embed sweep without introducing a scheduler framework. */
export function createScheduledEmbedRuntime(deps: ScheduledRuntimeDeps = defaultScheduledDeps()) {
  return {
    async runSweep(client: Client): Promise<void> {
      const dueRes = await deps.findDueScheduled();
      if (dueRes.isErr()) {
        deps.log.error("Failed to fetch scheduled embeds", dueRes.error);
        return;
      }

      for (const config of dueRes.unwrap()) {
        try {
          if (!config.channelId || !config.scheduleIntervalHours) continue;
          const guild = await client.guilds.fetch(config.guildId).catch(() => null);
          if (!guild) continue;
          const channel = await guild.channels.fetch(config.channelId).catch(() => null);
          if (!channel?.isTextBased()) continue;

          const sent = await deps.sendEmbed(config, channel, guild);
          const now = deps.now();
          const patch: Partial<EmbedConfig> = {
            scheduledLastSentAt: now,
            scheduledNextSendAt: new Date(now.getTime() + config.scheduleIntervalHours * 3_600_000),
          };
          if (config.stickyEnabled) patch.stickyMessageId = sent.id;

          // WHY: next-send time is advanced only after a successful send. A
          // failed send remains due for the next sweep instead of disappearing.
          const patchRes = await deps.patchEmbedConfig(config._id, patch);
          if (patchRes.isErr())
            deps.log.warn("Failed to update scheduled embed state", { id: config._id });
        } catch (error) {
          deps.log.error("Scheduled embed failed", { id: config._id, error });
        }
      }
    },
  };
}
