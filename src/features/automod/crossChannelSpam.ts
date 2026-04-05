/**
 * Cross-channel spam detection.
 *
 * Detects accounts that post the same message across multiple channels in a
 * short window — the classic pattern of raid/spam bots. Detection is based on
 * an in-memory sliding window per guild:user. On trigger: all cached messages
 * are deleted, an optional auto-timeout is applied, and a mod alert embed is
 * posted with action buttons.
 *
 * Configuration: guild.automod.crossChannelSpam
 */

import {
  EmbedBuilder,
  Colors,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Message,
  type TextChannel,
  type GuildMember,
} from "discord.js";
import { getGuild } from "@/db/repositories/guilds";
import { createLogger } from "@/core/logger";

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

/** Call once from onLoad — prunes stale entries every 5 minutes. */
export function startCleanupInterval(): void {
  setInterval(
    () => {
      const cutoff = Date.now() - 5 * 60 * 1000;
      for (const [key, entries] of recentMessages) {
        const live = entries.filter((e) => e.ts > cutoff);
        if (live.length === 0) recentMessages.delete(key);
        else recentMessages.set(key, live);
      }
    },
    5 * 60 * 1000,
  );
}

// ─── Main check ──────────────────────────────────────────────────────────────

export async function checkCrossChannelSpam(message: Message): Promise<void> {
  if (!message.guild || !message.member) return;

  const guildResult = await getGuild(message.guild.id);
  if (guildResult.isErr() || !guildResult.unwrap()) return;

  const config = guildResult.unwrap()!.automod.crossChannelSpam;
  if (!config.enabled) return;

  const normalized = normalize(message.content);
  if (normalized.length < 20) return;

  const key = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;

  // Prune old entries, add current
  const entries = (recentMessages.get(key) ?? []).filter((e) => now - e.ts < windowMs);
  entries.push({ normalized, channelId: message.channelId, messageId: message.id, ts: now });
  recentMessages.set(key, entries);

  // Count distinct channels with the same normalized content
  const matching = entries.filter((e) => e.normalized === normalized);
  const uniqueChannels = new Set(matching.map((e) => e.channelId));

  if (uniqueChannels.size < config.minChannels) return;

  // ── Triggered ──
  log.warn(`Cross-channel spam detected: ${message.author.tag} in ${uniqueChannels.size} channels`);

  // Clear tracking immediately to avoid double-triggering
  recentMessages.delete(key);

  // Delete all cached messages in the window
  await deleteSpamMessages(message, matching);

  // Auto-timeout
  if (config.autoTimeout) {
    await applyTimeout(message.member, config.timeoutSeconds * 1000, "Cross-channel spam");
  }

  // Post mod alert
  if (config.reportChannelId) {
    await postSpamAlert(message, normalized, [...uniqueChannels], config.reportChannelId);
  }
}

// ─── Actions ─────────────────────────────────────────────────────────────────

async function deleteSpamMessages(
  trigger: Message,
  cached: TrackedMessage[],
): Promise<void> {
  // Delete the triggering message and all cached ones (best-effort, no throw)
  const deletions = cached.map(async (entry) => {
    try {
      if (entry.channelId === trigger.channelId && entry.messageId === trigger.id) {
        await trigger.delete();
        return;
      }
      const channel = await trigger.guild!.channels.fetch(entry.channelId);
      if (!channel?.isTextBased() || !("messages" in channel)) return;
      const msg = await (channel as TextChannel).messages.fetch(entry.messageId);
      await msg.delete();
    } catch { /* best-effort */ }
  });
  await Promise.allSettled(deletions);
}

async function applyTimeout(member: GuildMember, durationMs: number, reason: string): Promise<void> {
  try {
    await member.timeout(durationMs, reason);
  } catch (err) {
    log.error("Failed to apply cross-channel spam timeout", err);
  }
}

async function postSpamAlert(
  message: Message,
  normalizedContent: string,
  channelIds: string[],
  reportChannelId: string,
): Promise<void> {
  if (!message.guild) return;

  try {
    const channel = await message.guild.channels.fetch(reportChannelId);
    if (!channel?.isTextBased() || !("send" in channel)) return;

    const accountAge = Math.floor(
      (Date.now() - message.author.createdTimestamp) / (1000 * 60 * 60 * 24),
    );

    const MAX_CHANNEL_DISPLAY = 5;
    const displayChannels = channelIds
      .slice(0, MAX_CHANNEL_DISPLAY)
      .map((id) => `<#${id}>`)
      .join(", ");
    const overflow = channelIds.length - MAX_CHANNEL_DISPLAY;
    const channelField = overflow > 0
      ? `${displayChannels} (+${overflow} more)`
      : displayChannels;

    const embed = new EmbedBuilder()
      .setColor(Colors.Red)
      .setTitle("Cross-Channel Spam Detected")
      .addFields(
        { name: "User", value: `<@${message.author.id}> (${message.author.tag})`, inline: true },
        { name: "Account age", value: `${accountAge} day${accountAge === 1 ? "" : "s"}`, inline: true },
        { name: "Channels hit", value: channelField },
        { name: "Message", value: normalizedContent.slice(0, 500) || "(empty)" },
      )
      .setFooter({ text: "Messages have been deleted. Apply further action below." })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`automod:spam:timeout:${message.author.id}`)
        .setLabel("Timeout 1h")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`automod:spam:ban:${message.author.id}`)
        .setLabel("Ban")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`automod:spam:dismiss:${message.author.id}`)
        .setLabel("Dismiss")
        .setStyle(ButtonStyle.Secondary),
    );

    await (channel as TextChannel).send({ embeds: [embed], components: [row] });
  } catch (err) {
    log.error("Failed to post spam alert", err);
  }
}
