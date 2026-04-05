/**
 * Raid detection.
 *
 * Tracks member joins per guild in a 60-second sliding window. When the
 * join rate exceeds joinsPerMinute and a significant portion of those
 * accounts are newer than minAccountAgeDays, a raid is suspected.
 *
 * Actions:
 *   alert     — post mod alert with action buttons, no automatic action
 *   lockdown  — alert + lock all channels (SendMessages = false)
 *   quarantine — alert + quarantine all joining members (if quarantine is configured)
 *
 * Configuration: guild.automod.raidDetection
 */

import {
  EmbedBuilder,
  Colors,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  type Client,
  type GuildMember,
  type TextChannel,
} from "discord.js";
import { getGuild } from "@/db/repositories/guilds";
import { createLogger } from "@/core/logger";

const log = createLogger("automod:raid");

// ─── Tracking ────────────────────────────────────────────────────────────────

interface JoinEntry {
  userId: string;
  accountCreatedAt: number;
  ts: number;
}

const joinHistory = new Map<string, JoinEntry[]>(); // guildId → entries

export function startRaidDetectionCleanup(): void {
  setInterval(
    () => {
      const cutoff = Date.now() - 5 * 60 * 1000;
      for (const [key, entries] of joinHistory) {
        const live = entries.filter((e) => e.ts > cutoff);
        if (live.length === 0) joinHistory.delete(key);
        else joinHistory.set(key, live);
      }
    },
    5 * 60 * 1000,
  );
}

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerRaidDetection(client: Client): void {
  client.on("guildMemberAdd", async (member) => {
    try {
      await onMemberJoin(member);
    } catch (err) {
      log.error("Raid detection error", err);
    }
  });
}

// ─── Detection ───────────────────────────────────────────────────────────────

async function onMemberJoin(member: GuildMember): Promise<void> {
  const guildResult = await getGuild(member.guild.id);
  if (guildResult.isErr() || !guildResult.unwrap()) return;

  const config = guildResult.unwrap()!.automod.raidDetection;
  if (!config.enabled) return;

  const now = Date.now();
  const windowMs = 60 * 1000; // always a 1-minute window for "per minute" metric

  const entries = (joinHistory.get(member.guild.id) ?? []).filter((e) => now - e.ts < windowMs);
  entries.push({ userId: member.id, accountCreatedAt: member.user.createdTimestamp, ts: now });
  joinHistory.set(member.guild.id, entries);

  if (entries.length < config.joinsPerMinute) return;

  // Check what % are new accounts
  const minAgeMs = config.minAccountAgeDays * 24 * 60 * 60 * 1000;
  const newAccounts = entries.filter((e) => now - e.accountCreatedAt < minAgeMs);
  const newAccountPct = newAccounts.length / entries.length;

  // Trigger if > 50% of the surge are new accounts
  if (newAccountPct < 0.5) return;

  log.warn(`Raid suspected in ${member.guild.name}: ${entries.length} joins/min, ${Math.round(newAccountPct * 100)}% new accounts`);

  // Clear tracking to prevent repeated triggers
  joinHistory.delete(member.guild.id);

  await handleRaid(member, entries, config);
}

async function handleRaid(
  trigger: GuildMember,
  entries: JoinEntry[],
  config: { action: "alert" | "lockdown" | "quarantine"; reportChannelId: string | null },
): Promise<void> {
  if (config.reportChannelId) {
    await postRaidAlert(trigger, entries, config.reportChannelId);
  }

  if (config.action === "lockdown") {
    await lockdownServer(trigger);
  }
}

async function postRaidAlert(
  trigger: GuildMember,
  entries: JoinEntry[],
  reportChannelId: string,
): Promise<void> {
  try {
    const channel = await trigger.guild.channels.fetch(reportChannelId);
    if (!channel?.isTextBased() || !("send" in channel)) return;

    const userList = entries
      .slice(0, 10)
      .map((e) => `<@${e.userId}>`)
      .join(", ");
    const overflow = entries.length > 10 ? ` (+${entries.length - 10} more)` : "";

    const embed = new EmbedBuilder()
      .setColor(Colors.Red)
      .setTitle("⚠️ Raid Suspected")
      .addFields(
        { name: "Joins in last 60s", value: `${entries.length}`, inline: true },
        { name: "New accounts (<threshold age)", value: `${entries.filter((e) => Date.now() - e.accountCreatedAt < 7 * 24 * 60 * 60 * 1000).length}`, inline: true },
        { name: "Recent Members", value: userList + overflow },
      )
      .setFooter({ text: "Use the buttons below to respond." })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`automod:raid:lockdown:${trigger.guild.id}`)
        .setLabel("Lockdown Server")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`automod:raid:dismiss:${trigger.guild.id}`)
        .setLabel("Dismiss")
        .setStyle(ButtonStyle.Secondary),
    );

    await (channel as TextChannel).send({ embeds: [embed], components: [row] });
  } catch (err) {
    log.error("Failed to post raid alert", err);
  }
}

async function lockdownServer(trigger: GuildMember): Promise<void> {
  const textChannels = trigger.guild.channels.cache.filter(
    (c) => c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement,
  );

  await Promise.allSettled(
    [...textChannels.values()].map((c) =>
      (c as TextChannel).permissionOverwrites.edit(
        trigger.guild.roles.everyone,
        { SendMessages: false },
        { reason: "Auto-lockdown: raid detected" },
      ).catch(() => {}),
    ),
  );
}
