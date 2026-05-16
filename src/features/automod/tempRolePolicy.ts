import type { Message } from "discord.js";
import type { TempRoleMessageRule, TempRolePolicyConfig } from "@/db/schemas/guild";
import type { AutomodPolicyDecision } from "./policy";
import {
  type AutomodRecommendedAction,
  type AutomodSignal,
  strongestAutomodSignal,
} from "./signals";

const SHORTENER_HOSTS = [
  "bit.ly",
  "t.co",
  "tinyurl.com",
  "cutt.ly",
  "is.gd",
  "rebrand.ly",
  "goo.gl",
];
const counterWindows = new Map<string, Array<{ count: number; ts: number }>>();
const crossChannelWindows = new Map<
  string,
  Array<{ normalized: string; channelId: string; messageId?: string; ts: number }>
>();

export interface TempRoleMemberAssignmentInput {
  readonly now: number;
  readonly accountCreatedAt: number;
  readonly roleIds: readonly string[];
}

export interface TempRoleMessageInput {
  readonly guildId: string;
  readonly userId: string;
  readonly channelId: string;
  readonly parentId?: string | null;
  readonly messageId?: string;
  readonly roleIds: readonly string[];
  readonly content: string;
  readonly attachmentCount: number;
  readonly stickerCount: number;
  readonly mentionCount: number;
  readonly createdAt: string;
}

function extractLinks(content: string): string[] {
  return content.match(/https?:\/\/[^\s>]+/gi) ?? [];
}

function hostname(rawUrl: string): string {
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

function normalizedContent(content: string): string {
  return content
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasScope(rule: TempRoleMessageRule, input: TempRoleMessageInput): boolean {
  const channelMatch = rule.channelIds.length === 0 || rule.channelIds.includes(input.channelId);
  const categoryMatch =
    rule.categoryIds.length === 0 ||
    (input.parentId ? rule.categoryIds.includes(input.parentId) : false);
  return channelMatch && categoryMatch;
}

function defaultLimit(rule: TempRoleMessageRule): number {
  if (rule.limit) return rule.limit;
  if (rule.kind === "crossChannel") return 3;
  return 1;
}

function countInWindow(key: string, count: number, windowSeconds: number | null): number {
  if (!windowSeconds) return count;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const live = (counterWindows.get(key) ?? []).filter((entry) => now - entry.ts < windowMs);
  live.push({ count, ts: now });
  counterWindows.set(key, live);
  return live.reduce((sum, entry) => sum + entry.count, 0);
}

function crossChannelCount(
  key: string,
  input: TempRoleMessageInput,
  windowSeconds: number | null,
): { channels: number; messageIds: readonly string[] } {
  const now = Date.now();
  const windowMs = (windowSeconds ?? 30) * 1000;
  const normalized = normalizedContent(input.content);
  const live = (crossChannelWindows.get(key) ?? []).filter((entry) => now - entry.ts < windowMs);
  live.push({ normalized, channelId: input.channelId, messageId: input.messageId, ts: now });
  crossChannelWindows.set(key, live);
  const matching = live.filter((entry) => entry.normalized === normalized);
  return {
    channels: new Set(matching.map((entry) => entry.channelId)).size,
    messageIds: matching.flatMap((entry) => (entry.messageId ? [entry.messageId] : [])),
  };
}

function countForRule(
  rule: TempRoleMessageRule,
  input: TempRoleMessageInput,
): {
  count: number;
  messageIds?: readonly string[];
} {
  const links = extractLinks(input.content);
  switch (rule.kind) {
    case "links":
      return {
        count: countInWindow(
          `${input.guildId}:${input.userId}:${rule.id}:links`,
          links.length,
          rule.windowSeconds,
        ),
      };
    case "media":
      return { count: input.attachmentCount + input.stickerCount };
    case "mentions":
      return {
        count: countInWindow(
          `${input.guildId}:${input.userId}:${rule.id}:mentions`,
          input.mentionCount,
          rule.windowSeconds,
        ),
      };
    case "invites":
      return { count: /(discord\.gg|discord(?:app)?\.com\/invite)\//i.test(input.content) ? 1 : 0 };
    case "repeatedText":
      return { count: /(.)\1{9,}/u.test(input.content) ? 1 : 0 };
    case "caps": {
      const letters = input.content.replace(/[^a-z]/gi, "");
      const uppercase = letters.replace(/[^A-Z]/g, "");
      return { count: letters.length >= 20 && uppercase.length / letters.length >= 0.8 ? 1 : 0 };
    }
    case "crossChannel": {
      const normalized = normalizedContent(input.content);
      if (normalized.length < 20) return { count: 0, messageIds: [] };
      const result = crossChannelCount(
        `${input.guildId}:${input.userId}:${rule.id}:cross`,
        input,
        rule.windowSeconds,
      );
      return { count: result.channels, messageIds: result.messageIds };
    }
    case "shortLinks":
      return {
        count: links.filter((url) => {
          const host = hostname(url);
          return SHORTENER_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`));
        }).length,
      };
    case "regex":
      if (!rule.pattern) return { count: 0 };
      try {
        return { count: new RegExp(rule.pattern, "i").test(input.content) ? 1 : 0 };
      } catch {
        return { count: 0 };
      }
  }
}

function actionSeverity(action: AutomodRecommendedAction): AutomodSignal["severity"] {
  if (action === "timeout") return "critical";
  if (action === "delete") return "high";
  return "medium";
}

function signalSummary(rule: TempRoleMessageRule, count: number): string {
  const limit = defaultLimit(rule);
  const window = rule.windowSeconds ? ` in ${rule.windowSeconds}s` : "";
  return `Recently joined ${rule.kind} rule "${rule.id}" matched (${count}/${limit}${window}).`;
}

/** Clears in-memory detector windows so focused tests start from known state. */
export function clearTempRolePolicyState(): void {
  counterWindows.clear();
  crossChannelWindows.clear();
}

/**
 * Decides whether a join should receive the configured temporary role.
 * Discord objects are narrowed before this point so the rule stays testable.
 */
export function shouldAssignTempRolePolicy(
  policy: TempRolePolicyConfig,
  input: TempRoleMemberAssignmentInput,
): boolean {
  if (!policy.enabled || !policy.roleId) return false;
  if (policy.skipRoleIds.some((roleId) => input.roleIds.includes(roleId))) return false;
  const accountAgeDays = (input.now - input.accountCreatedAt) / (24 * 60 * 60 * 1000);
  return accountAgeDays <= policy.maxAccountAgeDays;
}

/**
 * Converts explicit temp-role policy rules into AutoMod signals.
 * The member must already carry the policy role; otherwise the policy is inert.
 */
export function detectTempRolePolicySignalsFromInput(
  input: TempRoleMessageInput,
  policy: TempRolePolicyConfig,
): AutomodSignal[] {
  if (!policy.enabled || !policy.roleId || !input.roleIds.includes(policy.roleId)) return [];
  const signals: AutomodSignal[] = [];
  for (const rule of policy.messageRules) {
    if (!rule.enabled || !hasScope(rule, input)) continue;
    const { count, messageIds } = countForRule(rule, input);
    const limit = defaultLimit(rule);
    if (count < limit) continue;
    signals.push({
      detectorId: `tempRole:${rule.kind}`,
      ruleId: rule.id,
      confidence: 0.92,
      severity: actionSeverity(rule.action),
      punishmentEligible: rule.action !== "report",
      recommendedAction: rule.action,
      target: {
        guildId: input.guildId,
        userId: input.userId,
        channelId: input.channelId,
        messageId: input.messageId,
        ...(messageIds?.length ? { messageIds } : {}),
      },
      evidence: {
        summary: signalSummary(rule, count),
        messageContent: input.content.slice(0, 500),
        fingerprint: `${rule.id}:${input.userId}`,
        metadata: {
          count,
          limit,
          timeoutSeconds: rule.timeoutSeconds,
          ...(rule.windowSeconds ? { windowSeconds: rule.windowSeconds } : {}),
        },
      },
      createdAt: input.createdAt,
    });
  }
  return signals;
}

/**
 * Discord boundary for temp-role message policy detection.
 */
export function detectTempRolePolicySignals(
  message: Message,
  policy: TempRolePolicyConfig,
): AutomodSignal[] {
  if (!message.guild || !message.member) return [];
  return detectTempRolePolicySignalsFromInput(
    {
      guildId: message.guild.id,
      userId: message.author.id,
      channelId: message.channelId,
      parentId: "parentId" in message.channel ? message.channel.parentId : null,
      messageId: message.id,
      roleIds: [...message.member.roles.cache.keys()],
      content: message.content,
      attachmentCount: message.attachments.size,
      stickerCount: message.stickers.size,
      mentionCount: message.mentions.users.size + message.mentions.roles.size,
      createdAt: new Date().toISOString(),
    },
    policy,
  );
}

/**
 * Builds a direct AutoMod decision for explicit temp-role policy matches.
 * Unlike global AutoMod, these rules have already chosen the action.
 */
export function directTempRoleDecision(
  signals: readonly AutomodSignal[],
): AutomodPolicyDecision | null {
  const signal = strongestAutomodSignal(signals);
  if (!signal) return null;
  const action = signal.recommendedAction;
  if (action !== "report" && action !== "delete" && action !== "timeout") return null;
  return {
    tier: action,
    action,
    destructive: action === "delete" || action === "timeout",
    reason: signal.evidence.summary,
    score: 0,
    signal,
  };
}

/** Returns the timeout requested by the strongest temp-role signal. */
export function tempRoleTimeoutMs(signals: readonly AutomodSignal[]): number {
  const signal = strongestAutomodSignal(signals);
  const seconds = signal?.evidence.metadata?.timeoutSeconds;
  return (typeof seconds === "number" ? seconds : 300) * 1000;
}
