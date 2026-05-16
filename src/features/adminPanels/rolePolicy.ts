import type {
  GuildRoleRecord,
  LimitWindow,
  RoleCommandOverride,
  RoleLimitRecord,
} from "@/db/schemas/guild";

export const MODERATION_ACTIONS = [
  { key: "timeout", label: "Timeout" },
  { key: "kick", label: "Kick" },
  { key: "ban", label: "Ban" },
  { key: "warn", label: "Warn" },
  { key: "purge", label: "Purge" },
] as const;

export function normalizeActionKey(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function parseLimitWindow(
  input: string,
): { ok: true; value: LimitWindow | null; seconds: number | null } | { ok: false; error: string } {
  const normalized = input.trim().toLowerCase();
  if (!normalized || normalized.startsWith("0")) {
    return { ok: true, value: null, seconds: null };
  }

  const match = normalized.match(/^(\d+)(m|h|d)$/);
  if (!match) {
    return { ok: false, error: "Use a window like 10m, 1h, 24h, or leave it blank." };
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const seconds = unit === "m" ? amount * 60 : unit === "h" ? amount * 3600 : amount * 86400;
  return { ok: true, value: normalized as LimitWindow, seconds };
}

export function formatOverride(value: RoleCommandOverride | undefined): string {
  if (value === "allow") return "Allow";
  if (value === "deny") return "Deny";
  return "Inherit";
}

export function formatLimit(limit: RoleLimitRecord | undefined): string {
  if (!limit || limit.limit <= 0) return "No limit";
  return `${limit.limit} use(s)${limit.window ? ` per ${limit.window}` : ""}`;
}

export function createRoleRecord(
  roleId: string,
  label: string,
  updatedBy: string,
): GuildRoleRecord {
  return {
    label,
    discordRoleId: roleId,
    reach: {},
    limits: {},
    updatedBy,
    updatedAt: new Date().toISOString(),
  };
}
