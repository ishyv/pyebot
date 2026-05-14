/**
 * Cross-channel spam detection.
 *
 * Tracks accounts that post the same message across multiple channels in a
 * short window. This module emits signals; shared AutoMod policy owns actions.
 */

import type { Message } from "discord.js";
import { createLogger } from "@/core/logger";
import { getGuild } from "@/db/repositories/guilds";
import type { AutomodConfig } from "@/db/schemas/guild";
import { processAutomodSignals } from "@/features/automod/service";
import type { AutomodSignal } from "./signals";

const log = createLogger("automod:cross-channel");

// ─── Tracking ────────────────────────────────────────────────────────────────

interface TrackedMessage {
  normalized: string;
  channelId: string;
  messageId: string;
  ts: number;
}

const recentMessages = new Map<string, TrackedMessage[]>();

function normalize(content: string): string {
  return content
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function pruneCrossChannelSpam(): void {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [key, entries] of recentMessages) {
    const live = entries.filter((e) => e.ts > cutoff);
    if (live.length === 0) recentMessages.delete(key);
    else recentMessages.set(key, live);
  }
}

/**
 * Backward-compatible wrapper used by older handlers and tests.
 */
export async function checkCrossChannelSpam(message: Message): Promise<void> {
  if (!message.guild || !message.member) return;
  const guildResult = await getGuild(message.guild.id);
  const guild = guildResult.isOk() ? guildResult.unwrap() : null;
  if (!guild) return;
  const config = guild.automod;
  await processAutomodSignals(message, config, detectCrossChannelSpam(message, config));
}

/**
 * Produces a signal when one account repeats content across enough channels.
 */
export function detectCrossChannelSpam(message: Message, config: AutomodConfig): AutomodSignal[] {
  if (!message.guild || !message.member) return [];
  if (!config.crossChannelSpam.enabled) return [];

  const normalized = normalize(message.content);
  if (normalized.length < 20) return [];

  const key = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();
  const windowMs = config.crossChannelSpam.windowSeconds * 1000;

  const entries = (recentMessages.get(key) ?? []).filter((e) => now - e.ts < windowMs);
  entries.push({ normalized, channelId: message.channelId, messageId: message.id, ts: now });
  recentMessages.set(key, entries);

  const matching = entries.filter((e) => e.normalized === normalized);
  const uniqueChannels = new Set(matching.map((e) => e.channelId));
  if (uniqueChannels.size < config.crossChannelSpam.minChannels) return [];

  recentMessages.delete(key);
  log.warn(`Cross-channel spam signal: ${message.author.tag} in ${uniqueChannels.size} channels`);

  return [
    {
      detectorId: "crossChannelSpam",
      ruleId: "crossChannelSpam:duplicate-content",
      confidence: 0.94,
      severity: "critical",
      punishmentEligible: config.crossChannelSpam.autoTimeout,
      recommendedAction: config.crossChannelSpam.autoTimeout ? "timeout" : "report",
      target: {
        guildId: message.guild.id,
        userId: message.author.id,
        channelId: message.channelId,
        messageId: message.id,
        messageIds: matching.map((entry) => entry.messageId),
        messageRefs: matching.map((entry) => ({
          channelId: entry.channelId,
          messageId: entry.messageId,
        })),
      },
      evidence: {
        summary: `Repeated message across ${uniqueChannels.size} channels.`,
        messageContent: normalized.slice(0, 500),
        fingerprint: normalized.slice(0, 80),
        metadata: {
          channels: uniqueChannels.size,
          messages: matching.length,
          windowSeconds: config.crossChannelSpam.windowSeconds,
        },
      },
      createdAt: new Date().toISOString(),
    },
  ];
}
