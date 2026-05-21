import { type GuildMember, type Message, PermissionFlagsBits } from "discord.js";
import type { AutomodConfig, PerUserSlowRuleConfig } from "@/db/schemas/guild";

interface SlowWindow {
  readonly cooldownEndsAt: number;
  readonly violations: number;
}

export interface PerUserSlowInput {
  readonly guildId: string;
  readonly userId: string;
  readonly channelId: string;
  readonly roleIds: readonly string[];
  readonly isStaff: boolean;
  readonly now: number;
}

export type PerUserSlowDecision =
  | {
      readonly action: "allow";
      readonly rule: PerUserSlowRuleConfig | null;
      readonly cooldownEndsAt?: number;
    }
  | {
      readonly action: "delete" | "warn" | "timeout";
      readonly rule: PerUserSlowRuleConfig;
      readonly cooldownEndsAt: number;
      readonly violations: number;
    };

const windows = new Map<string, SlowWindow>();

function windowKey(input: PerUserSlowInput, rule: PerUserSlowRuleConfig): string {
  return `${input.guildId}:${input.userId}:${rule.roleId}`;
}

function hasAnyRole(roleIds: readonly string[], candidates: readonly string[]): boolean {
  return candidates.some((roleId) => roleIds.includes(roleId));
}

/**
 * Chooses the active slow rule for a member after global AutoMod bypasses are
 * applied. When multiple slow roles match, the strictest cooldown wins so a
 * weaker role cannot dilute a stronger restriction.
 */
export function selectPerUserSlowRule(
  config: AutomodConfig,
  input: PerUserSlowInput,
): PerUserSlowRuleConfig | null {
  const slow = config.perUserSlow;
  if (!slow.enabled) return null;

  const bypass = config.policy.bypass;
  if (bypass.ignoredChannelIds.includes(input.channelId)) return null;
  if (bypass.staffBypass && input.isStaff) return null;
  if (hasAnyRole(input.roleIds, bypass.trustedRoleIds)) return null;
  if (hasAnyRole(input.roleIds, bypass.protectedRoleIds)) return null;

  return (
    slow.rules
      .filter((rule) => rule.enabled && rule.roleId && input.roleIds.includes(rule.roleId))
      .sort((a, b) => b.cooldownSeconds - a.cooldownSeconds)[0] ?? null
  );
}

/**
 * Advances the per-member cooldown window and returns the side effect the
 * Discord boundary should apply. This function owns only hot-path memory; role
 * expiry is persisted separately as grant lifecycle state.
 */
export function evaluatePerUserSlow(
  config: AutomodConfig,
  input: PerUserSlowInput,
): PerUserSlowDecision {
  prunePerUserSlowState(input.now);
  const rule = selectPerUserSlowRule(config, input);
  if (!rule) return { action: "allow", rule: null };

  const key = windowKey(input, rule);
  const existing = windows.get(key);
  if (!existing || input.now >= existing.cooldownEndsAt) {
    const cooldownEndsAt = input.now + rule.cooldownSeconds * 1000;
    windows.set(key, { cooldownEndsAt, violations: 0 });
    return { action: "allow", rule, cooldownEndsAt };
  }

  const violations = existing.violations + 1;
  windows.set(key, { ...existing, violations });
  if (violations >= 3) {
    return { action: "timeout", rule, cooldownEndsAt: existing.cooldownEndsAt, violations };
  }
  if (violations === 2) {
    return { action: "warn", rule, cooldownEndsAt: existing.cooldownEndsAt, violations };
  }
  return { action: "delete", rule, cooldownEndsAt: existing.cooldownEndsAt, violations };
}

/**
 * Builds testable slow input from Discord's message object at the runtime
 * boundary where roles and permissions are still Discord.js concerns.
 */
export function perUserSlowInputFromMessage(
  message: Message,
  now = Date.now(),
): PerUserSlowInput | null {
  if (!message.guild || !message.member) return null;
  return {
    guildId: message.guild.id,
    userId: message.author.id,
    channelId: message.channelId,
    roleIds: [...message.member.roles.cache.keys()],
    isStaff: message.member.permissions.has(PermissionFlagsBits.ManageMessages),
    now,
  };
}

/**
 * Returns configured slow roles newly added to a member update. The handler
 * persists expiry grants for these roles and leaves non-slow role changes alone.
 */
export function newlyAddedPerUserSlowRules(
  config: AutomodConfig,
  oldMember: GuildMember,
  newMember: GuildMember,
): PerUserSlowRuleConfig[] {
  if (!config.perUserSlow.enabled) return [];
  return config.perUserSlow.rules.filter(
    (rule) =>
      rule.enabled &&
      rule.roleId &&
      !oldMember.roles.cache.has(rule.roleId) &&
      newMember.roles.cache.has(rule.roleId),
  );
}

/** Drops expired cooldown windows; exported so tests can start from known state. */
export function prunePerUserSlowState(now = Date.now()): void {
  for (const [key, value] of windows) {
    if (now >= value.cooldownEndsAt) windows.delete(key);
  }
}

/** Clears all in-memory slow windows for focused tests. */
export function clearPerUserSlowState(): void {
  windows.clear();
}
