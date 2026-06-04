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
  ButtonStyle,
  ChannelType,
  type Client,
  type GuildMember,
  type TextChannel,
} from "discord.js";
import { createLogger } from "@/core/logger";
import { getGuild } from "@/db/repositories/guilds";
import { container, row, separator, text, v2Message } from "@/ui/v2";
import { routes } from "./routes";

const log = createLogger("automod:raid");

// ─── Tracking ────────────────────────────────────────────────────────────────

interface JoinEntry {
  userId: string;
  accountCreatedAt: number;
  ts: number;
}

const joinHistory = new Map<string, JoinEntry[]>(); // guildId → entries

export function pruneRaidDetectionHistory(): void {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [key, entries] of joinHistory) {
    const live = entries.filter((e) => e.ts > cutoff);
    if (live.length === 0) joinHistory.delete(key);
    else joinHistory.set(key, live);
  }
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
  if (guildResult.isErr()) return;
  const guild = guildResult.unwrap();
  if (!guild) return;

  const config = guild.automod.raidDetection;
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

  log.warn(
    `Raid suspected in ${member.guild.name}: ${entries.length} joins/min, ${Math.round(newAccountPct * 100)}% new accounts`,
  );

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
    const newAccountCount = entries.filter(
      (e) => Date.now() - e.accountCreatedAt < 7 * 24 * 60 * 60 * 1000,
    ).length;

    const alertRow = row(
      routes["raid-lockdown"].button({}, { label: "Lockdown Server", style: ButtonStyle.Danger }),
      routes["raid-dismiss"].button({}, { label: "Dismiss", style: ButtonStyle.Secondary }),
    );

    const alertPayload = v2Message(
      container(
        "danger",
        text("## Raid Suspected"),
        separator("sm"),
        text(
          `**Joins in last 60s:** ${entries.length}\n**New accounts (<threshold age):** ${newAccountCount}\n**Recent Members:** ${userList + overflow}`,
        ),
        separator("sm"),
        text("-# Use the buttons below to respond."),
        alertRow,
      ),
    );
    // biome-ignore lint/suspicious/noExplicitAny: V2 ContainerBuilder is valid at runtime but not in discord.js MessageCreateOptions types.
    await (channel as TextChannel).send(alertPayload as any);
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
      (c as TextChannel).permissionOverwrites
        .edit(
          trigger.guild.roles.everyone,
          { SendMessages: false },
          { reason: "Auto-lockdown: raid detected" },
        )
        .catch(() => {}),
    ),
  );
}
