/**
 * Automod service.
 *
 * Detects and acts on two categories:
 *   1. Link spam: too many links in a short window → timeout/delete/report
 *   2. Content filters: regex patterns matching spam/scam phrases → delete + report
 *
 * Configuration read from guild.automod (schema: AutomodSchema in guild.ts).
 * Banned-image analysis only emits signals; policy still owns actions.
 */

import {
  type GuildMember,
  type Message,
  type MessageCreateOptions,
  PermissionFlagsBits,
  type TextChannel,
} from "discord.js";
import { getDb } from "@/core/db";
import { createLogger } from "@/core/logger";
import { getGuild } from "@/db/repositories/guilds";
import type { AutomodConfig } from "@/db/schemas/guild";
import { recordAutomodSystemCase } from "@/features/moderation/service";
import { container, separator, text, v2Message } from "@/ui/v2";
import { type AutomodIncident, recordAutomodIncident } from "./incidents";
import { type AutomodPolicyDecision, evaluateAutomodPolicy } from "./policy";
import { type AutomodProfile, updateAutomodProfile } from "./profile";
import type { AutomodSignal } from "./signals";

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
    filter:
      /(?=.*\b(eth|ethereum|btc|bitcoin|capital|crypto|memecoins|nitro|\$|nsfw)\b)(?=.*\b(gana\w*|gratis|multiplica\w*|inver\w*|giveaway|server|free|earn)\b)/is,
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

// ─── Link spam tracking (in-memory per guild:user) ────────────────────────────

const linkTimestamps = new Map<string, number[]>(); // `${guildId}:${userId}` → timestamps
const automodProfiles = new Map<string, AutomodProfile>();
const automodIncidents = new Map<string, AutomodIncident>();
const alertTimestamps = new Map<string, number[]>();
const actionTimestamps = new Map<string, number[]>();

function extractLinks(content: string): string[] {
  return content.match(/https?:\/\/[^\s>]+/gi) ?? [];
}

function extractHostname(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return (
      rawUrl
        .replace(/^https?:\/\//i, "")
        .split(/[/?#\s]/)[0]
        ?.toLowerCase() ?? ""
    );
  }
}

// ─── Main check function ──────────────────────────────────────────────────────

export interface CheckResult {
  action: "none" | "delete" | "timeout" | "report" | "warn" | "quarantine" | "lockdown-request";
  reason?: string;
  muteMember?: boolean;
}

export async function checkMessage(message: Message): Promise<CheckResult> {
  if (!message.guild || !message.member) return { action: "none" };
  if (message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return { action: "none" };

  const guildResult = await getGuild(message.guild.id);
  const guild = guildResult.isOk() ? guildResult.unwrap() : null;
  if (!guild) return { action: "none" };

  const config = guild.automod;
  const signals = detectMessageContentSignals(message, config);
  return processAutomodSignals(message, config, signals);
}

/**
 * Detects message-content AutoMod signals without applying Discord side effects.
 */
export function detectMessageContentSignals(
  message: Message,
  config: AutomodConfig,
): AutomodSignal[] {
  if (!message.guild) return [];
  const content = message.content;
  const createdAt = new Date().toISOString();
  const baseTarget = {
    guildId: message.guild.id,
    userId: message.author.id,
    channelId: message.channelId,
    messageId: message.id,
  };
  const signals: AutomodSignal[] = [];

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
      const key = `${baseTarget.guildId}:${baseTarget.userId}`;
      const now = Date.now();
      const times = (linkTimestamps.get(key) ?? []).filter((t) => now - t < windowMs);
      times.push(...Array(nonWhitelisted.length).fill(now));
      linkTimestamps.set(key, times);

      if (times.length >= config.linkSpam.maxLinks) {
        linkTimestamps.delete(key);
        const reason = `Link spam (${times.length} links in ${config.linkSpam.windowSeconds}s)`;
        signals.push({
          detectorId: "linkSpam",
          ruleId: "linkSpam:window",
          confidence: 0.88,
          severity: "high",
          punishmentEligible: true,
          recommendedAction:
            config.linkSpam.action === "report"
              ? "report"
              : config.linkSpam.action === "delete"
                ? "delete"
                : "timeout",
          target: baseTarget,
          evidence: {
            summary: reason,
            messageContent: content.slice(0, 500),
            fingerprint: nonWhitelisted.map(extractHostname).sort().join(",") || "links",
            metadata: { links: times.length, windowSeconds: config.linkSpam.windowSeconds },
          },
          createdAt,
        });
      }
    }
  }

  // 2. Spam filter patterns
  for (const { filter, mute, warnMessage } of SPAM_FILTERS) {
    if (filter.test(content)) {
      const reason = warnMessage ?? "Spam filter match";
      signals.push({
        detectorId: "builtInSpamPattern",
        ruleId: filter.source,
        confidence: mute ? 0.96 : 0.82,
        severity: mute ? "critical" : "high",
        punishmentEligible: true,
        recommendedAction: mute ? "timeout" : "delete",
        target: baseTarget,
        evidence: {
          summary: reason,
          messageContent: content.slice(0, 500),
          matchedRule: filter.source,
          fingerprint: filter.source,
        },
        createdAt,
      });
    }
  }

  // 3. Scam phrase patterns
  for (const filter of SCAM_FILTERS) {
    if (filter.test(content)) {
      const reason = "Scam phrase detected";
      signals.push({
        detectorId: "scamPhrase",
        ruleId: filter.source,
        confidence: 0.9,
        severity: "critical",
        punishmentEligible: true,
        recommendedAction: "delete",
        target: baseTarget,
        evidence: {
          summary: reason,
          messageContent: content.slice(0, 500),
          matchedRule: filter.source,
          fingerprint: filter.source,
        },
        createdAt,
      });
    }
  }

  // 4. Custom guild patterns
  const customPatterns = config.customPatterns ?? [];
  if (customPatterns.length > 0) {
    const compiled = getCompiledPatterns(message.guild.id, customPatterns);
    for (const { regex, patternConfig } of compiled) {
      if (regex.test(content)) {
        const reason = `Custom pattern match: ${patternConfig.name}`;
        signals.push({
          detectorId: "customPattern",
          ruleId: patternConfig.name,
          confidence: patternConfig.action === "report" ? 0.72 : 0.9,
          severity: patternConfig.action === "timeout" ? "critical" : "high",
          punishmentEligible: patternConfig.action !== "report",
          recommendedAction: patternConfig.action,
          target: baseTarget,
          evidence: {
            summary: reason,
            messageContent: content.slice(0, 500),
            matchedRule: patternConfig.pattern,
            fingerprint: patternConfig.name,
          },
          createdAt,
        });
      }
    }
  }

  signals.push(...detectGeneralCues(message, config, createdAt));
  return signals;
}

/**
 * Applies shared AutoMod policy to signals and performs the chosen action.
 */
export async function processAutomodSignals(
  message: Message,
  config: AutomodConfig,
  signals: readonly AutomodSignal[],
): Promise<CheckResult> {
  if (!message.guild || !message.member || signals.length === 0) return { action: "none" };

  const now = new Date();
  const profileKey = `${message.guild.id}:${message.author.id}`;
  const accountAgeDays = Math.floor(
    (Date.now() - message.author.createdTimestamp) / (24 * 60 * 60 * 1000),
  );
  const roleIds = [...message.member.roles.cache.keys()];
  const trustedRoleState = config.policy.bypass.protectedRoleIds.some((id) => roleIds.includes(id))
    ? "protected"
    : config.policy.bypass.trustedRoleIds.some((id) => roleIds.includes(id))
      ? "trusted"
      : "none";
  const profile = updateAutomodProfile(automodProfiles.get(profileKey) ?? null, signals, {
    now,
    retentionDays: config.policy.profileRetentionDays,
    accountAgeDays,
    trustedRoleState,
  });
  automodProfiles.set(profileKey, profile);

  const decision = evaluateAutomodPolicy({
    config,
    profile,
    signals,
    member: {
      isStaff: message.member.permissions.has(PermissionFlagsBits.ManageMessages),
      roleIds,
    },
    channelId: message.channelId,
  });

  return applyAutomodDecision(message, config, decision, signals);
}

/**
 * Performs the Discord side effects for an already-decided AutoMod outcome.
 * Global policy and temp-role rules both use this so delete/report/timeout
 * behavior stays in one place.
 */
export async function applyAutomodDecision(
  message: Message,
  config: AutomodConfig,
  decision: AutomodPolicyDecision,
  signals: readonly AutomodSignal[],
  options: { readonly reportChannelId?: string | null; readonly timeoutMs?: number } = {},
): Promise<CheckResult> {
  if (!message.guild || !message.member || signals.length === 0) return { action: "none" };
  const now = new Date();
  if (decision.signal) {
    const incident = recordAutomodIncident(automodIncidents, decision.signal, {
      now,
      windowSeconds: config.policy.alertRateLimit.windowSeconds,
    });
    await persistAutomodIncident(incident, decision).catch((err) =>
      log.error("Failed to persist automod incident", err),
    );
  }

  if (decision.action === "none") return { action: "none", reason: decision.reason };

  const reportChannelId = options.reportChannelId ?? reportChannelForSignals(config, signals);
  if (
    decision.action === "report" ||
    decision.tier === "lockdown-request" ||
    decision.tier === "quarantine"
  ) {
    if (
      allowRateLimited(
        alertTimestamps,
        `alert:${message.guild.id}`,
        config.policy.alertRateLimit.maxAlerts,
        config.policy.alertRateLimit.windowSeconds,
      )
    ) {
      await reportToChannel(message, formatDecisionReason(decision), reportChannelId);
    }
    return { action: decision.action, reason: decision.reason };
  }

  if (
    !allowRateLimited(
      actionTimestamps,
      `action:${message.guild.id}`,
      config.policy.actionRateLimit.maxActions,
      config.policy.actionRateLimit.windowSeconds,
    )
  ) {
    await reportToChannel(
      message,
      `AutoMod action rate limit reached. Would have applied: ${formatDecisionReason(decision)}`,
      reportChannelId,
    );
    return { action: "report", reason: decision.reason };
  }

  if (decision.action === "delete" || decision.action === "warn" || decision.action === "timeout") {
    await deleteSignalMessages(message, signals);
  }

  if (decision.action === "timeout") {
    await applyTimeout(
      message.member,
      options.timeoutMs ?? timeoutMsForSignals(config, signals),
      decision.reason,
    );
    await recordAutomodSystemCase(
      message.guild,
      message.member,
      "TIMEOUT",
      decision.reason,
      evidenceSummary(signals),
    ).catch((err) => log.error("Failed to record AutoMod timeout case", err));
  } else if (decision.action === "warn") {
    await recordAutomodSystemCase(
      message.guild,
      message.member,
      "WARN",
      decision.reason,
      evidenceSummary(signals),
    ).catch((err) => log.error("Failed to record AutoMod warn case", err));
  }

  await reportToChannel(message, formatDecisionReason(decision), reportChannelId);
  return {
    action: decision.action,
    reason: decision.reason,
    muteMember: decision.action === "timeout",
  };
}

function detectGeneralCues(
  message: Message,
  config: AutomodConfig,
  createdAt: string,
): AutomodSignal[] {
  if (!message.guild) return [];
  const content = message.content;
  const target = {
    guildId: message.guild.id,
    userId: message.author.id,
    channelId: message.channelId,
    messageId: message.id,
  };
  const signals: AutomodSignal[] = [];
  const links = extractLinks(content);
  const accountAgeDays = Math.floor(
    (Date.now() - message.author.createdTimestamp) / (24 * 60 * 60 * 1000),
  );

  if (/(discord\.gg|discord(?:app)?\.com\/invite)\//i.test(content)) {
    signals.push({
      detectorId: "inviteSpam",
      ruleId: "inviteSpam:discordInvite",
      confidence: 0.86,
      severity: "high",
      punishmentEligible: true,
      recommendedAction: "delete",
      target,
      evidence: {
        summary: "Discord invite link detected.",
        messageContent: content.slice(0, 500),
        fingerprint: "discord-invite",
      },
      createdAt,
    });
  }

  const letters = content.replace(/[^a-z]/gi, "");
  const uppercase = letters.replace(/[^A-Z]/g, "");
  if (letters.length >= 20 && uppercase.length / letters.length >= 0.8) {
    signals.push({
      detectorId: "capsFlood",
      confidence: 0.45,
      severity: "low",
      punishmentEligible: false,
      recommendedAction: "report",
      target,
      evidence: {
        summary: "High uppercase ratio.",
        messageContent: content.slice(0, 500),
        fingerprint: "caps-flood",
      },
      createdAt,
    });
  }

  if (/(.)\1{9,}/u.test(content) || message.stickers.size >= 4) {
    signals.push({
      detectorId: "floodPattern",
      confidence: 0.5,
      severity: "medium",
      punishmentEligible: false,
      recommendedAction: "report",
      target,
      evidence: {
        summary: "Repeated character or sticker flood pattern.",
        messageContent: content.slice(0, 500),
        fingerprint: "flood-pattern",
      },
      createdAt,
    });
  }

  if (message.attachments.size >= 5) {
    signals.push({
      detectorId: "attachmentBurst",
      confidence: 0.55,
      severity: "medium",
      punishmentEligible: false,
      recommendedAction: "report",
      target,
      evidence: {
        summary: `${message.attachments.size} attachments in one message.`,
        fingerprint: "attachment-burst",
        metadata: { attachments: message.attachments.size },
      },
      createdAt,
    });
  }

  if (config.shorteners.enabled && links.length > 0) {
    const hosts = links.map(extractHostname);
    const shortenerHosts = hosts.filter((host) =>
      config.shorteners.allowedShorteners.some(
        (domain) => host === domain || host.endsWith(`.${domain}`),
      ),
    );
    if (shortenerHosts.length > 0) {
      signals.push({
        detectorId: "shortLink",
        confidence: config.shorteners.resolveFinalUrl ? 0.5 : 0.42,
        severity: "medium",
        punishmentEligible: false,
        recommendedAction: "report",
        target,
        evidence: {
          summary: "URL shortener detected.",
          messageContent: content.slice(0, 500),
          fingerprint: shortenerHosts.sort().join(","),
          metadata: { shortLinks: shortenerHosts.length },
        },
        createdAt,
      });
    }
  }

  if (accountAgeDays <= 2 && links.length > 0) {
    signals.push({
      detectorId: "newAccountLink",
      confidence: 0.5,
      severity: "medium",
      punishmentEligible: false,
      recommendedAction: "report",
      target,
      evidence: {
        summary: `Very new account posted ${links.length} link${links.length === 1 ? "" : "s"}.`,
        messageContent: content.slice(0, 500),
        fingerprint: "new-account-link",
        metadata: { accountAgeDays, links: links.length },
      },
      createdAt,
    });
  }

  return signals;
}

function reportChannelForSignals(
  config: AutomodConfig,
  signals: readonly AutomodSignal[],
): string | null {
  for (const signal of signals) {
    if (signal.detectorId === "bannedImage" && config.imageDetection.reportChannelId)
      return config.imageDetection.reportChannelId;
    if (signal.detectorId === "mentionSpam" && config.mentionSpam.reportChannelId)
      return config.mentionSpam.reportChannelId;
    if (signal.detectorId === "crossChannelSpam" && config.crossChannelSpam.reportChannelId)
      return config.crossChannelSpam.reportChannelId;
    if (signal.detectorId === "raidDetection" && config.raidDetection.reportChannelId)
      return config.raidDetection.reportChannelId;
  }
  return (
    config.linkSpam.reportChannelId ??
    config.mentionSpam.reportChannelId ??
    config.crossChannelSpam.reportChannelId ??
    config.raidDetection.reportChannelId ??
    config.imageDetection.reportChannelId
  );
}

function timeoutMsForSignals(config: AutomodConfig, signals: readonly AutomodSignal[]): number {
  if (signals.some((signal) => signal.detectorId === "mentionSpam"))
    return config.mentionSpam.timeoutSeconds * 1000;
  if (signals.some((signal) => signal.detectorId === "crossChannelSpam"))
    return config.crossChannelSpam.timeoutSeconds * 1000;
  if (signals.some((signal) => signal.detectorId === "linkSpam"))
    return config.linkSpam.timeoutSeconds * 1000;
  return 5 * 60 * 1000;
}

function formatDecisionReason(decision: AutomodPolicyDecision): string {
  return `AutoMod ${decision.tier} (score ${decision.score}): ${decision.reason}`;
}

function evidenceSummary(signals: readonly AutomodSignal[]): string {
  return signals
    .map((signal) => `${signal.detectorId}: ${signal.evidence.summary}`)
    .join("; ")
    .slice(0, 1000);
}

function allowRateLimited(
  store: Map<string, number[]>,
  key: string,
  limit: number,
  windowSeconds: number,
): boolean {
  const now = Date.now();
  const windowMs = Math.max(windowSeconds, 1) * 1000;
  const live = (store.get(key) ?? []).filter((ts) => now - ts < windowMs);
  if (live.length >= limit) {
    store.set(key, live);
    return false;
  }
  live.push(now);
  store.set(key, live);
  return true;
}

async function deleteSignalMessages(
  message: Message,
  signals: readonly AutomodSignal[],
): Promise<void> {
  const refs = new Map<string, Set<string>>();
  const addRef = (channelId: string | undefined, messageId: string | undefined) => {
    if (!channelId || !messageId) return;
    const ids = refs.get(channelId) ?? new Set<string>();
    ids.add(messageId);
    refs.set(channelId, ids);
  };

  for (const signal of signals) {
    addRef(signal.target.channelId, signal.target.messageId);
    for (const messageId of signal.target.messageIds ?? [])
      addRef(signal.target.channelId, messageId);
    for (const ref of signal.target.messageRefs ?? []) addRef(ref.channelId, ref.messageId);
  }
  if (refs.size === 0) addRef(message.channelId, message.id);

  await Promise.allSettled(
    [...refs.entries()].flatMap(([channelId, ids]) =>
      [...ids].map(async (messageId) => {
        if (channelId === message.channelId && messageId === message.id) {
          await safeDelete(message);
          return;
        }
        const channel = await message.guild?.channels.fetch(channelId);
        if (!channel?.isTextBased() || !("messages" in channel)) return;
        const cached = await (channel as TextChannel).messages.fetch(messageId);
        await cached.delete();
      }),
    ),
  );
}

async function persistAutomodIncident(
  incident: AutomodIncident,
  decision: AutomodPolicyDecision,
): Promise<void> {
  const db = await getDb();
  await db.collection("automod_incidents").updateOne(
    { _id: incident.id } as never,
    {
      $set: {
        guildId: incident.guildId,
        detectorId: incident.detectorId,
        fingerprint: incident.fingerprint,
        userIds: incident.userIds,
        channelIds: incident.channelIds,
        messageIds: incident.messageIds,
        firstSeenAt: incident.firstSeenAt,
        lastSeenAt: incident.lastSeenAt,
        count: incident.count,
        decision: {
          tier: decision.tier,
          action: decision.action,
          score: decision.score,
          destructive: decision.destructive,
          reason: decision.reason,
        },
      },
      $setOnInsert: { createdAt: new Date() },
    } as never,
    { upsert: true },
  );
}

// ─── Custom pattern regex cache ──────────────────────────────────────────────

interface PatternConfig {
  name: string;
  pattern: string;
  flags: string;
  action: "delete" | "timeout" | "report";
  timeoutSeconds: number;
}

interface CompiledPattern {
  regex: RegExp;
  patternConfig: PatternConfig;
}

const patternCache = new Map<string, CompiledPattern[]>();

function getCompiledPatterns(guildId: string, configs: PatternConfig[]): CompiledPattern[] {
  const cached = patternCache.get(guildId);
  if (cached) return cached;

  const compiled: CompiledPattern[] = [];
  for (const cfg of configs) {
    try {
      compiled.push({ regex: new RegExp(cfg.pattern, cfg.flags), patternConfig: cfg });
    } catch {
      // Invalid regex — skip silently
    }
  }
  patternCache.set(guildId, compiled);
  return compiled;
}

/** Call this when a guild updates its custom patterns so the cache is refreshed. */
export function invalidatePatternCache(guildId: string): void {
  patternCache.delete(guildId);
}

// ─── Action helpers ───────────────────────────────────────────────────────────

async function safeDelete(message: Message): Promise<void> {
  try {
    await message.delete();
  } catch {
    /* best-effort */
  }
}

async function applyTimeout(
  member: GuildMember,
  durationMs: number,
  reason: string,
): Promise<void> {
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

    await (channel as TextChannel).send(
      v2Message(
        container(
          "danger",
          text("## Automod Action"),
          separator("sm"),
          text(
            `**Reason:** ${reason}\n` +
              `**User:** <@${message.author.id}> (${message.author.tag})\n` +
              `**Channel:** <#${message.channelId}>\n` +
              `**Content:** ${message.content.slice(0, 500) || "(empty)"}`,
          ),
        ),
      ) as MessageCreateOptions,
    );
  } catch (err) {
    log.error("Failed to report to automod channel", err);
  }
}
