/**
 * Automod service.
 *
 * Detects and acts on two categories:
 *   1. Link spam: too many links in a short window → timeout/delete/report
 *   2. Content filters: regex patterns matching spam/scam phrases → delete + report
 *
 * Configuration read from guild.automod (schema: AutomodSchema in guild.ts).
 * OCR/image analysis is intentionally excluded.
 */

import {
  EmbedBuilder,
  Colors,
  PermissionFlagsBits,
  type GuildMember,
  type TextChannel,
  type Message,
} from "discord.js";
import { getGuild } from "@/db/repositories/guilds";
import { createLogger } from "@/core/logger";
import { recordLinks, clearLinkRecord } from "./linkTracker";

const log = createLogger("automod");

// ─── Spam filter patterns ─────────────────────────────────────────────────────
// Ported from tx/src/constants/automod.ts

interface SpamFilter {
  filter: RegExp;
  mute: boolean;
  warnMessage?: string;
}

const SPAM_FILTERS: SpamFilter[] = [
  { filter: /https?:\/\/[\w.-]+\.xyz($|\W)/i, mute: false, warnMessage: "🚫 Suspicious link." },
  { filter: /https?:\/\/[\w.-]+\.click($|\W)/i, mute: false, warnMessage: "🚫 Suspicious link." },
  { filter: /https?:\/\/[\w.-]+\.info($|\W)/i, mute: false, warnMessage: "🚫 Suspicious link." },
  { filter: /https?:\/\/[\w.-]+\.ru($|\W)/i, mute: false, warnMessage: "🚫 Suspicious link." },
  { filter: /https?:\/\/[\w.-]+\.biz($|\W)/i, mute: false, warnMessage: "🚫 Suspicious link." },
  { filter: /https?:\/\/[\w.-]+\.online($|\W)/i, mute: false, warnMessage: "🚫 Suspicious link." },
  { filter: /(https?:\/\/)?(t\.me|telegram\.me|wa\.me|whatsapp\.me)\/.+/i, mute: true },
  { filter: /(https?:\/\/)?(pornhub|xvideos|xhamster|xnxx|hentaila)(\.\S+)+\//i, mute: true },
  { filter: /(https?:\/\/)?discord\.com\/invite\/.+/i, mute: true },
  {
    filter: /(?=.*\b(eth|ethereum|btc|bitcoin|capital|crypto|memecoins|nitro|\$|nsfw)\b)(?=.*\b(gana\w*|gratis|multiplica\w*|inver\w*|giveaway|server|free|earn)\b)/is,
    mute: false,
    warnMessage: "Possible scam detected",
  },
];

const SCAM_PHRASES = [
  "free nitro",
  "free discord nitro",
  "claim your nitro",
  "free bonus code",
  "crypto casino",
  "free gift code",
  "claim your reward",
  "special promo code",
];

const SCAM_FILTERS: RegExp[] = SCAM_PHRASES.map(
  (phrase) => new RegExp(`\\b${phrase.replace(/\s+/g, "[\\s\\W_]+")}\\b`, "i"),
);


function extractLinks(content: string): string[] {
  return content.match(/https?:\/\/[^\s>]+/gi) ?? [];
}

function extractHostname(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return rawUrl.replace(/^https?:\/\//i, "").split(/[/?#\s]/)[0]?.toLowerCase() ?? "";
  }
}

// ─── Main check function ──────────────────────────────────────────────────────

export interface CheckResult {
  action: "none" | "delete" | "timeout" | "report";
  reason?: string;
  muteMember?: boolean;
}

export async function checkMessage(message: Message): Promise<CheckResult> {
  if (!message.guild || !message.member) return { action: "none" };
  if (message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return { action: "none" };

  const guildResult = await getGuild(message.guild.id);
  if (guildResult.isErr() || !guildResult.unwrap()) return { action: "none" };

  const config = guildResult.unwrap()!.automod;
  const content = message.content;

  // 1. Link spam check
  if (config.linkSpam.enabled) {
    const links = extractLinks(content);
    const domainWhitelist = config.domainWhitelist.enabled ? config.domainWhitelist.domains : [];

    const nonWhitelisted = links.filter((url) => {
      const host = extractHostname(url);
      return !domainWhitelist.some(
        (d) => host === d.toLowerCase() || host.endsWith(`.${d.toLowerCase()}`),
      );
    });

    if (nonWhitelisted.length > 0) {
      const windowMs = config.linkSpam.windowSeconds * 1000;
      const totalLinks = await recordLinks(message.guild.id, message.author.id, nonWhitelisted.length, windowMs);

      if (totalLinks >= config.linkSpam.maxLinks) {
        await clearLinkRecord(message.guild.id, message.author.id);
        const action = config.linkSpam.action;
        const reason = `Link spam (${totalLinks} links in ${config.linkSpam.windowSeconds}s)`;

        if (action === "timeout" || action === "mute") {
          await applyTimeout(message.member, config.linkSpam.timeoutSeconds * 1000, reason);
          await safeDelete(message);
          await reportToChannel(message, reason, config.linkSpam.reportChannelId);
          return { action: "timeout", reason };
        }

        if (action === "delete") {
          await safeDelete(message);
          await reportToChannel(message, reason, config.linkSpam.reportChannelId);
          return { action: "delete", reason };
        }

        if (action === "report") {
          await reportToChannel(message, reason, config.linkSpam.reportChannelId);
          return { action: "report", reason };
        }
      }
    }
  }

  // 2. Spam filter patterns
  for (const { filter, mute, warnMessage } of SPAM_FILTERS) {
    if (filter.test(content)) {
      const reason = warnMessage ?? "Spam filter match";
      await safeDelete(message);
      if (mute) await applyTimeout(message.member, 5 * 60 * 1000, reason);
      await reportToChannel(message, reason, null);
      return { action: mute ? "timeout" : "delete", reason, muteMember: mute };
    }
  }

  // 3. Scam phrase patterns
  for (const filter of SCAM_FILTERS) {
    if (filter.test(content)) {
      const reason = "Scam phrase detected";
      await safeDelete(message);
      await reportToChannel(message, reason, null);
      return { action: "delete", reason };
    }
  }

  return { action: "none" };
}

// ─── Action helpers ───────────────────────────────────────────────────────────

async function safeDelete(message: Message): Promise<void> {
  try {
    await message.delete();
  } catch { /* best-effort */ }
}

async function applyTimeout(member: GuildMember, durationMs: number, reason: string): Promise<void> {
  try {
    await member.timeout(durationMs, reason);
  } catch (err) {
    log.error("Failed to apply timeout", err);
  }
}

async function reportToChannel(
  message: Message,
  reason: string,
  reportChannelId: string | null,
): Promise<void> {
  if (!message.guild) return;

  const channelId = reportChannelId;
  if (!channelId) return;

  try {
    const channel = await message.guild.channels.fetch(channelId);
    if (!channel?.isTextBased() || !("send" in channel)) return;

    const embed = new EmbedBuilder()
      .setColor(Colors.Red)
      .setTitle("Automod Action")
      .setDescription(`**Reason:** ${reason}`)
      .addFields(
        { name: "User", value: `<@${message.author.id}> (${message.author.tag})`, inline: true },
        { name: "Channel", value: `<#${message.channelId}>`, inline: true },
        { name: "Content", value: message.content.slice(0, 500) || "(empty)" },
      )
      .setTimestamp();

    await (channel as TextChannel).send({ embeds: [embed] });
  } catch (err) {
    log.error("Failed to report to automod channel", err);
  }
}
