/**
 * Mention spam detection.
 *
 * Counts unique user + role mentions per message. If a single message
 * exceeds maxMentions, or if cumulative mentions across messages within
 * windowSeconds exceed maxMentions, the configured action is taken.
 *
 * Configuration: guild.automod.mentionSpam
 */

import {
  EmbedBuilder,
  Colors,
  PermissionFlagsBits,
  type Message,
  type TextChannel,
  type GuildMember,
} from "discord.js";
import { getGuild } from "@/db/repositories/guilds";
import { createLogger } from "@/core/logger";

const log = createLogger("automod:mention-spam");

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

// ─── Main check ──────────────────────────────────────────────────────────────

export async function checkMentionSpam(message: Message): Promise<void> {
  if (!message.guild || !message.member) return;
  if (message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return;

  const mentionCount = message.mentions.users.size + message.mentions.roles.size;
  if (mentionCount === 0) return;

  const guildResult = await getGuild(message.guild.id);
  if (guildResult.isErr() || !guildResult.unwrap()) return;

  const config = guildResult.unwrap()!.automod.mentionSpam;
  if (!config.enabled) return;

  // Per-message threshold (single message with too many mentions)
  if (mentionCount >= config.maxMentions) {
    await trigger(message, config, mentionCount);
    return;
  }

  // Windowed threshold (cumulative mentions across messages)
  const key = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;

  const entries = (mentionHistory.get(key) ?? []).filter((e) => now - e.ts < windowMs);
  entries.push({ count: mentionCount, ts: now });
  mentionHistory.set(key, entries);

  const totalMentions = entries.reduce((s, e) => s + e.count, 0);
  if (totalMentions >= config.maxMentions) {
    mentionHistory.delete(key);
    await trigger(message, config, totalMentions);
  }
}

// ─── Action ──────────────────────────────────────────────────────────────────

async function trigger(
  message: Message,
  config: { action: "timeout" | "delete" | "report"; timeoutSeconds: number; reportChannelId: string | null },
  mentionCount: number,
): Promise<void> {
  const reason = `Mention spam (${mentionCount} mentions)`;
  log.warn(`Mention spam: ${message.author.tag} — ${mentionCount} mentions`);

  try { await message.delete(); } catch { /* best-effort */ }

  if (config.action === "timeout") {
    await applyTimeout(message.member!, config.timeoutSeconds * 1000, reason);
  }

  if (config.action !== "delete" && config.reportChannelId) {
    await postAlert(message, reason, mentionCount, config.reportChannelId);
  }
}

async function applyTimeout(member: GuildMember, durationMs: number, reason: string): Promise<void> {
  try {
    await member.timeout(durationMs, reason);
  } catch (err) {
    log.error("Failed to apply mention spam timeout", err);
  }
}

async function postAlert(
  message: Message,
  reason: string,
  mentionCount: number,
  reportChannelId: string,
): Promise<void> {
  try {
    const channel = await message.guild!.channels.fetch(reportChannelId);
    if (!channel?.isTextBased() || !("send" in channel)) return;

    const embed = new EmbedBuilder()
      .setColor(Colors.Orange)
      .setTitle("Mention Spam Detected")
      .addFields(
        { name: "User", value: `<@${message.author.id}> (${message.author.tag})`, inline: true },
        { name: "Channel", value: `<#${message.channelId}>`, inline: true },
        { name: "Mention Count", value: `${mentionCount}`, inline: true },
        { name: "Reason", value: reason },
      )
      .setTimestamp();

    await (channel as TextChannel).send({ embeds: [embed] });
  } catch (err) {
    log.error("Failed to post mention spam alert", err);
  }
}
