import type {
  TempRoleAccessRule,
  TempRoleMessageRule,
  TempRolePolicyConfig,
} from "@/db/schemas/guild";

const RULE_LABELS: Record<TempRoleMessageRule["kind"], string> = {
  links: "Links",
  media: "Media",
  mentions: "Mentions",
  invites: "Invites",
  repeatedText: "Repeated text",
  caps: "Caps",
  crossChannel: "Cross-channel spam",
  shortLinks: "Short links",
  regex: "Regex",
};

function channelList(ids: readonly string[]): string {
  return ids.length ? ids.map((id) => `<#${id}>`).join(", ") : "all channels";
}

function categoryList(ids: readonly string[]): string {
  return ids.length ? ids.map((id) => `category ${id}`).join(", ") : "";
}

function scopeText(rule: TempRoleMessageRule): string {
  const channels = channelList(rule.channelIds);
  const categories = categoryList(rule.categoryIds);
  return categories ? `${channels} under ${categories}` : channels;
}

/** Parses moderator-entered durations like `10m`, `2h`, or `7d`. */
export function parseDurationSeconds(
  input: string,
): { ok: true; seconds: number } | { ok: false; error: string } {
  const match = input
    .trim()
    .toLowerCase()
    .match(/^(\d+)(m|h|d)$/);
  if (!match) return { ok: false, error: "Use a duration like 10m, 2h, or 7d." };
  const amount = Number(match[1]);
  const unit = match[2];
  const seconds = unit === "m" ? amount * 60 : unit === "h" ? amount * 3600 : amount * 86400;
  if (!Number.isInteger(seconds) || seconds < 60) {
    return { ok: false, error: "Duration must be at least 1 minute." };
  }
  return { ok: true, seconds };
}

/** Formats one explicit message rule as the moderator-facing review sentence. */
export function formatTempRoleMessageRule(rule: TempRoleMessageRule): string {
  const limit = rule.limit ?? (rule.kind === "crossChannel" ? 3 : 1);
  const window = rule.windowSeconds ? ` per ${rule.windowSeconds}s` : "";
  const timeout = rule.action === "timeout" ? ` for ${rule.timeoutSeconds}s` : "";
  const pattern = rule.kind === "regex" && rule.pattern ? ` /${rule.pattern}/` : "";
  return `${RULE_LABELS[rule.kind]}${pattern}: ${limit}${window} in ${scopeText(rule)} -> ${rule.action}${timeout}`;
}

/** Formats one access blocklist rule as the moderator-facing review sentence. */
export function formatTempRoleAccessRule(rule: TempRoleAccessRule): string {
  const verb = rule.mode === "view" ? "viewing" : "sending";
  return `Block ${verb} in ${rule.targetType} ${rule.targetId}`;
}

/** Summarizes the permission overwrites that the New Users panel will apply. */
export function accessOverwritePreview(policy: TempRolePolicyConfig): string {
  const enabled = policy.accessRules.filter((rule) => rule.enabled);
  if (!enabled.length) return "No access blocklist rules configured.";
  return enabled
    .map((rule) => {
      const action = rule.mode === "view" ? "view this target" : "send messages";
      return `Recently Joined cannot ${action} in ${rule.targetType} ${rule.targetId}.`;
    })
    .join("\n");
}

/** Compact review block used by the New Users panel. */
export function formatTempRolePolicyReview(policy: TempRolePolicyConfig): string {
  const messageRules = policy.messageRules.filter((rule) => rule.enabled);
  const accessRules = policy.accessRules.filter((rule) => rule.enabled);
  return [
    `Status: ${policy.enabled ? "Enabled" : "Disabled"}`,
    `Role: ${policy.roleId ? `<@&${policy.roleId}>` : "Not set"}`,
    `Duration: ${policy.durationSeconds}s`,
    `Assignment: accounts up to ${policy.maxAccountAgeDays}d old; skip ${policy.skipRoleIds.length} role(s)`,
    `Reports: ${policy.reportChannelId ? `<#${policy.reportChannelId}>` : "Not set"}`,
    `Message rules: ${messageRules.length}`,
    ...(messageRules.length ? messageRules.slice(0, 5).map(formatTempRoleMessageRule) : []),
    `Access rules: ${accessRules.length}`,
    ...(accessRules.length ? accessRules.slice(0, 5).map(formatTempRoleAccessRule) : []),
  ].join("\n");
}
