/**
 * Mention spam detection.
 *
 * Counts unique user + role mentions per message and across a short user
 * window. This module only emits signals; shared AutoMod policy applies the
 * final action.
 */

import { type Message, PermissionFlagsBits } from "discord.js";
import { getGuild } from "@/db/repositories/guilds";
import type { AutomodConfig } from "@/db/schemas/guild";
import { processAutomodSignals } from "@/features/automod/service";
import type { AutomodSignal } from "./signals";

// ─── Tracking ────────────────────────────────────────────────────────────────

const mentionHistory = new Map<string, Array<{ count: number; ts: number }>>();

export function pruneMentionSpam(): void {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [key, entries] of mentionHistory) {
    const live = entries.filter((e) => e.ts > cutoff);
    if (live.length === 0) mentionHistory.delete(key);
    else mentionHistory.set(key, live);
  }
}

/**
 * Backward-compatible wrapper used by older handlers and tests.
 */
export async function checkMentionSpam(message: Message): Promise<void> {
  if (!message.guild || !message.member) return;
  const guildResult = await getGuild(message.guild.id);
  const guild = guildResult.isOk() ? guildResult.unwrap() : null;
  if (!guild) return;
  const config = guild.automod;
  await processAutomodSignals(message, config, detectMentionSpam(message, config));
}

/**
 * Produces mention-spam signals without deleting, reporting, or timing out.
 */
export function detectMentionSpam(message: Message, config: AutomodConfig): AutomodSignal[] {
  if (!message.guild || !message.member) return [];
  if (message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return [];
  if (!config.mentionSpam.enabled) return [];

  const mentionCount = message.mentions.users.size + message.mentions.roles.size;
  if (mentionCount === 0) return [];

  const now = Date.now();
  const windowMs = config.mentionSpam.windowSeconds * 1000;
  let totalMentions = mentionCount;

  if (mentionCount < config.mentionSpam.maxMentions) {
    const key = `${message.guild.id}:${message.author.id}`;
    const entries = (mentionHistory.get(key) ?? []).filter((e) => now - e.ts < windowMs);
    entries.push({ count: mentionCount, ts: now });
    mentionHistory.set(key, entries);
    totalMentions = entries.reduce((sum, entry) => sum + entry.count, 0);
    if (totalMentions < config.mentionSpam.maxMentions) return [];
    mentionHistory.delete(key);
  }

  return [
    {
      detectorId: "mentionSpam",
      ruleId: "mentionSpam:window",
      confidence: mentionCount >= config.mentionSpam.maxMentions ? 0.9 : 0.82,
      severity: totalMentions >= config.mentionSpam.maxMentions * 2 ? "critical" : "high",
      punishmentEligible: true,
      recommendedAction: config.mentionSpam.action,
      target: {
        guildId: message.guild.id,
        userId: message.author.id,
        channelId: message.channelId,
        messageId: message.id,
      },
      evidence: {
        summary: `Mention spam (${totalMentions} mentions in ${config.mentionSpam.windowSeconds}s).`,
        messageContent: message.content.slice(0, 500),
        fingerprint: "mention-spam",
        metadata: {
          mentions: totalMentions,
          windowSeconds: config.mentionSpam.windowSeconds,
        },
      },
      createdAt: new Date().toISOString(),
    },
  ];
}
