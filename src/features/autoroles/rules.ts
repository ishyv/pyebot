import type { AutoroleRuleValue } from "@/components/autorole-rule";

/**
 * Parses admin-entered temporary role durations at the command boundary.
 * A null result means the role is permanent.
 */
export function parseDurationMs(value: string | null | undefined): number | null {
  const raw = value?.trim();
  if (!raw) return null;

  const match = /^(\d+)([mhd])$/.exec(raw);
  if (!match) throw new Error("Use a duration like 30m, 2h, or 7d.");

  const amount = Number(match[1]);
  if (amount <= 0) throw new Error("Duration must be greater than zero.");

  const unit = match[2];
  if (unit === "m") return amount * 60_000;
  if (unit === "h") return amount * 60 * 60_000;
  return amount * 24 * 60 * 60_000;
}

/**
 * Normalizes Discord emoji input into the same key emitted by reaction events.
 * Unicode stays as-is; custom emoji become `name:id`.
 */
export function normalizeEmoji(value: string): string {
  const trimmed = value.trim();
  const custom = /^<a?:([^:>]+):(\d+)>$/.exec(trimmed);
  if (custom) return `${custom[1]}:${custom[2]}`;
  return trimmed;
}

export function reactionEmojiKey(input: {
  readonly emoji: { readonly name: string | null; readonly id: string | null };
}): string {
  return input.emoji.id ? `${input.emoji.name}:${input.emoji.id}` : (input.emoji.name ?? "?");
}

export function timedGrantId(
  guildId: string,
  userId: string,
  roleId: string,
  ruleId: string,
): string {
  return `${guildId}:${userId}:${roleId}:${ruleId}`;
}

export function findJoinRules(rules: readonly AutoroleRuleValue[]): AutoroleRuleValue[] {
  return rules.filter((rule) => rule.enabled && rule.trigger.type === "onJoin");
}

export function findReactRules(
  rules: readonly AutoroleRuleValue[],
  messageId: string,
  emoji: string,
): AutoroleRuleValue[] {
  return rules.filter(
    (rule) =>
      rule.enabled &&
      rule.trigger.type === "onReact" &&
      rule.trigger.messageId === messageId &&
      (rule.trigger.emoji === emoji || rule.trigger.emoji === "*"),
  );
}

export function findMessageRules(
  rules: readonly AutoroleRuleValue[],
  content: string,
): AutoroleRuleValue[] {
  const lower = content.toLowerCase();
  return rules.filter(
    (rule) =>
      rule.enabled &&
      rule.trigger.type === "messageContains" &&
      rule.trigger.keywords.some((keyword) => lower.includes(keyword.toLowerCase())),
  );
}

export function findButtonRules(
  rules: readonly AutoroleRuleValue[],
  messageId: string,
  roleId: string,
): AutoroleRuleValue[] {
  return rules.filter(
    (rule) =>
      rule.enabled &&
      rule.trigger.type === "onButton" &&
      rule.trigger.messageId === messageId &&
      rule.roleId === roleId,
  );
}
