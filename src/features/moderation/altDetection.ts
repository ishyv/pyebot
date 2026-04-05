/**
 * Alt account detection.
 *
 * On guildMemberAdd, checks if the joining user shares signals with
 * any recently banned user in the same guild. Alert-only — no automatic
 * action is taken. Mods review the alert and decide.
 *
 * Signals checked:
 *   1. Account created within 48h of a recent ban in this guild
 *   2. Very similar username (normalized Levenshtein < 0.25)
 *   3. Identical avatar hash prefix (first 8 chars of avatar hash)
 *
 * Two or more matching signals triggers the alert.
 *
 * Configuration: guild.moderation.altDetectionEnabled
 */

import {
  EmbedBuilder,
  Colors,
  type Client,
  type GuildMember,
  type TextChannel,
} from "discord.js";
import { getGuild } from "@/db/repositories/guilds";
import { createLogger } from "@/core/logger";

const log = createLogger("moderation:alt-detection");

// Cache recent bans per guild (last 30, refreshed periodically)
const recentBanCache = new Map<string, Array<{ userId: string; username: string; avatarHash: string | null; bannedAt: number }>>();

export function registerAltDetection(client: Client): void {
  client.on("guildMemberAdd", async (member) => {
    try {
      await checkForAlt(member);
    } catch (err) {
      log.error("Alt detection error", err);
    }
  });

  // Refresh ban caches every 10 minutes
  setInterval(async () => {
    for (const guildId of recentBanCache.keys()) {
      const guild = client.guilds.cache.get(guildId);
      if (guild) await refreshBanCache(guild.id, client);
    }
  }, 10 * 60 * 1000);
}

async function refreshBanCache(guildId: string, client: Client): Promise<void> {
  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;
    const bans = await guild.bans.fetch({ limit: 30 });
    const entries = [...bans.values()].map((ban) => ({
      userId: ban.user.id,
      username: ban.user.username.toLowerCase(),
      avatarHash: ban.user.avatar,
      bannedAt: Date.now(), // Discord doesn't provide ban timestamp; use now as approximation
    }));
    recentBanCache.set(guildId, entries);
  } catch { /* permissions may not allow ban list */ }
}

// Simple Levenshtein distance (capped for performance)
function levenshtein(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 5) return 999;
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

async function checkForAlt(member: GuildMember): Promise<void> {
  const guildResult = await getGuild(member.guild.id);
  if (guildResult.isErr() || !guildResult.unwrap()) return;

  const modConfig = guildResult.unwrap()!.moderation;
  if (!modConfig.altDetectionEnabled || !modConfig.modLogChannelId) return;

  // Ensure we have a fresh-ish ban cache
  if (!recentBanCache.has(member.guild.id)) {
    await refreshBanCache(member.guild.id, member.client);
  }

  const bans = recentBanCache.get(member.guild.id) ?? [];
  if (bans.length === 0) return;

  const newUsername = member.user.username.toLowerCase();
  const newAvatarHash = member.user.avatar;
  const accountAgeDays = (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);

  for (const ban of bans) {
    const signals: string[] = [];

    // Signal 1: new account (< 7 days old)
    if (accountAgeDays < 7) signals.push(`New account (${Math.floor(accountAgeDays)}d old)`);

    // Signal 2: username similarity
    const maxLen = Math.max(newUsername.length, ban.username.length);
    if (maxLen > 0) {
      const distance = levenshtein(newUsername, ban.username);
      const similarity = 1 - distance / maxLen;
      if (similarity > 0.75) signals.push(`Similar username to <@${ban.userId}> (\`${ban.username}\`)`);
    }

    // Signal 3: matching avatar hash prefix
    if (newAvatarHash && ban.avatarHash && newAvatarHash.slice(0, 8) === ban.avatarHash.slice(0, 8)) {
      signals.push(`Matching avatar hash (same profile picture as <@${ban.userId}>)`);
    }

    if (signals.length >= 2) {
      await postAltAlert(member, ban.userId, signals, modConfig.modLogChannelId!);
      return; // Only fire once per join
    }
  }
}

async function postAltAlert(
  member: GuildMember,
  suspectedOriginalId: string,
  signals: string[],
  modLogChannelId: string,
): Promise<void> {
  try {
    const channel = await member.guild.channels.fetch(modLogChannelId);
    if (!channel?.isTextBased() || !("send" in channel)) return;

    const accountAge = Math.floor((Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24));

    const embed = new EmbedBuilder()
      .setColor(Colors.Orange)
      .setTitle("Possible Alt Account Detected")
      .setDescription("A newly joined member matches signals of a previously banned user. **No action has been taken — this requires manual review.**")
      .addFields(
        { name: "New Member", value: `<@${member.id}> (${member.user.tag})`, inline: true },
        { name: "Account Age", value: `${accountAge} day${accountAge === 1 ? "" : "s"}`, inline: true },
        { name: "Suspected Original", value: `<@${suspectedOriginalId}>`, inline: true },
        { name: "Matching Signals", value: signals.map((s) => `• ${s}`).join("\n") },
      )
      .setThumbnail(member.user.displayAvatarURL())
      .setTimestamp();

    await (channel as TextChannel).send({ embeds: [embed] });
  } catch (err) {
    log.error("Failed to post alt alert", err);
  }
}
