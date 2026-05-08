/**
 * Slowmode automation.
 *
 * Tracks per-channel message rates in a sliding window. When the rate
 * exceeds the configured threshold, slowmode is applied automatically.
 * It releases after releaseAfterSeconds.
 *
 * Configuration: guild.automod.slowmode
 */

import { type Message, type TextChannel } from "discord.js";
import { getGuild } from "@/db/repositories/guilds";
import { createLogger } from "@/core/logger";

const log = createLogger("automod:slowmode");

// ─── Tracking ────────────────────────────────────────────────────────────────

// Per channelId: message timestamps in the window
const channelMessages = new Map<string, number[]>();
// Channels currently under forced slowmode (we set it; we should release it)
const managedSlowmodes = new Map<string, ReturnType<typeof setTimeout>>();

export function pruneSlowmodeMessages(): void {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [key, entries] of channelMessages) {
    const live = entries.filter((t) => t > cutoff);
    if (live.length === 0) channelMessages.delete(key);
    else channelMessages.set(key, live);
  }
}

// ─── Main check ──────────────────────────────────────────────────────────────

export async function checkSlowmode(message: Message): Promise<void> {
  if (!message.guild || !message.channel.isTextBased()) return;
  if (managedSlowmodes.has(message.channelId)) return; // already under managed slowmode

  const guildResult = await getGuild(message.guild.id);
  if (guildResult.isErr() || !guildResult.unwrap()) return;

  const config = guildResult.unwrap()!.automod.slowmode;
  if (!config.enabled) return;

  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;

  const times = (channelMessages.get(message.channelId) ?? []).filter((t) => now - t < windowMs);
  times.push(now);
  channelMessages.set(message.channelId, times);

  if (times.length < config.messagesPerWindow) return;

  // Threshold crossed — apply slowmode
  channelMessages.delete(message.channelId);
  log.info(`Applying auto-slowmode to #${message.channelId} (${times.length} msgs/${config.windowSeconds}s)`);

  const channel = message.channel as TextChannel;
  try {
    await channel.setRateLimitPerUser(config.slowmodeSeconds, "Auto-slowmode: high message rate");
  } catch (err) {
    log.error("Failed to apply slowmode", err);
    return;
  }

  // Schedule release
  const timer = setTimeout(async () => {
    managedSlowmodes.delete(message.channelId);
    try {
      await channel.setRateLimitPerUser(0, "Auto-slowmode lifted");
    } catch {
      // Channel may no longer exist
    }
  }, config.releaseAfterSeconds * 1000);

  managedSlowmodes.set(message.channelId, timer);
}
