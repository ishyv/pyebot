import type {
  AutomodSettingsPatch,
  BannedImageTestInput,
  BannedImageUploadInput,
  EconomyDailyPatch,
  EconomyTaxPatch,
  EconomyWorkPatch,
  ModerationBridgeAction,
} from "$shared/bridge-types";

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; field?: string };

interface PerUserSlowRulePatch {
  readonly enabled: boolean;
  readonly roleId: string;
  readonly cooldownSeconds: number;
  readonly durationSeconds: number;
}

const MAX_DASHBOARD_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif"]);

function ok<T>(value: T): ParseResult<T> {
  return { ok: true, value };
}

function err<T>(error: string, field?: string): ParseResult<T> {
  return { ok: false, error, field };
}

export function text(value: FormDataEntryValue | null): string | null {
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function finiteNumber(data: FormData, key: string, fallback: number): ParseResult<number> {
  const raw = data.get(key);
  const value = raw === null || String(raw).trim() === "" ? fallback : Number(raw);
  if (!Number.isFinite(value)) return err(`${key} must be numeric.`, key);
  return ok(value);
}

function nonNegativeInt(data: FormData, key: string, fallback: number): ParseResult<number> {
  const parsed = finiteNumber(data, key, fallback);
  if (!parsed.ok) return parsed;
  const value = Math.trunc(parsed.value);
  if (value < 0) return err(`${key} must be non-negative.`, key);
  return ok(value);
}

function positiveInt(data: FormData, key: string, fallback: number): ParseResult<number> {
  const parsed = nonNegativeInt(data, key, fallback);
  if (!parsed.ok) return parsed;
  if (parsed.value < 1) return err(`${key} must be at least 1.`, key);
  return ok(parsed.value);
}

function rate(data: FormData, key: string, fallback: number): ParseResult<number> {
  const parsed = finiteNumber(data, key, fallback);
  if (!parsed.ok) return parsed;
  if (parsed.value < 0 || parsed.value > 1) return err(`${key} must be between 0 and 1.`, key);
  return ok(parsed.value);
}

export function parseDailyEconomyPatch(data: FormData): ParseResult<EconomyDailyPatch> {
  const reward = nonNegativeInt(data, "reward", 0);
  if (!reward.ok) return reward;
  const cooldown = positiveInt(data, "cooldownHours", 24);
  if (!cooldown.ok) return cooldown;
  const streak = nonNegativeInt(data, "streakBonus", 0);
  if (!streak.ok) return streak;
  return ok({
    dailyReward: reward.value,
    dailyCooldownHours: cooldown.value,
    dailyStreakBonus: streak.value,
  });
}

export function parseWorkEconomyPatch(data: FormData): ParseResult<EconomyWorkPatch> {
  const reward = nonNegativeInt(data, "rewardBase", 0);
  if (!reward.ok) return reward;
  const cooldown = positiveInt(data, "cooldownMinutes", 30);
  if (!cooldown.ok) return cooldown;
  const cap = positiveInt(data, "dailyCap", 5);
  if (!cap.ok) return cap;
  const failure = rate(data, "failureChance", 0);
  if (!failure.ok) return failure;
  return ok({
    workRewardBase: reward.value,
    workCooldownMinutes: cooldown.value,
    workDailyCap: cap.value,
    workFailureChance: failure.value,
  });
}

export function parseTaxEconomyPatch(data: FormData): ParseResult<EconomyTaxPatch> {
  const taxRate = rate(data, "rate", 0);
  if (!taxRate.ok) return taxRate;
  const minimum = nonNegativeInt(data, "minimumTaxableAmount", 0);
  if (!minimum.ok) return minimum;
  return ok({
    enabled: data.get("enabled") === "on",
    rate: taxRate.value,
    minimumTaxableAmount: minimum.value,
  });
}

export function parseAutomodPatch(
  data: FormData,
  section: "linkSpam" | "mentionSpam" | "perUserSlow" | "imageDetection",
): ParseResult<AutomodSettingsPatch> {
  if (section === "imageDetection") {
    const tolerance = text(data.get("tolerance")) ?? "balanced";
    if (tolerance !== "strict" && tolerance !== "balanced" && tolerance !== "loose") {
      return err("tolerance must be strict, balanced, or loose.");
    }
    return ok({
      imageDetection: {
        enabled: data.get("enabled") === "on",
        reportChannelId: text(data.get("reportChannelId")),
        tolerance,
      },
    });
  }

  if (section === "perUserSlow") {
    const parsedRules = parsePerUserSlowRules(data);
    if (!parsedRules.ok) return parsedRules;
    return ok({
      perUserSlow: {
        enabled: data.get("enabled") === "on",
        rules: parsedRules.value,
      },
    });
  }

  const windowSeconds = positiveInt(data, "windowSeconds", 10);
  if (!windowSeconds.ok) return windowSeconds;
  if (section === "linkSpam") {
    const maxLinks = positiveInt(data, "maxLinks", 4);
    if (!maxLinks.ok) return maxLinks;
    return ok({
      linkSpam: {
        enabled: data.get("enabled") === "on",
        maxLinks: maxLinks.value,
        windowSeconds: windowSeconds.value,
        reportChannelId: text(data.get("reportChannelId")),
      },
    });
  }
  const maxMentions = positiveInt(data, "maxMentions", 5);
  if (!maxMentions.ok) return maxMentions;
  return ok({
    mentionSpam: {
      enabled: data.get("enabled") === "on",
      maxMentions: maxMentions.value,
      windowSeconds: windowSeconds.value,
    },
  });
}

interface ParsedImageFile {
  readonly filename: string | null;
  readonly contentType: string | null;
  readonly bytes: Uint8Array;
}

function extensionFromName(name: string | null): string | null {
  const ext = name?.split(".").pop()?.toLowerCase();
  return ext && IMAGE_EXTENSIONS.has(ext) ? ext : null;
}

async function parseImageFile(data: FormData): Promise<ParseResult<ParsedImageFile>> {
  const file = data.get("image");
  if (!(file instanceof File)) return err("image file required.");
  if (file.size < 1) return err("image file required.");
  if (file.size > MAX_DASHBOARD_IMAGE_BYTES) return err("image must be 8MB or smaller.");

  const filename = text(file.name) ?? null;
  const contentType = text(file.type) ?? null;
  const supported =
    (contentType?.startsWith("image/") && contentType !== "image/svg+xml") ||
    extensionFromName(filename) !== null;
  if (!supported) return err("image must be a supported raster format.");

  return ok({
    filename,
    contentType,
    bytes: new Uint8Array(await file.arrayBuffer()),
  });
}

export async function parseBannedImageUpload(
  data: FormData,
): Promise<ParseResult<BannedImageUploadInput>> {
  const reason = text(data.get("reason"));
  if (!reason) return err("reason required.");
  const image = await parseImageFile(data);
  if (!image.ok) return image;
  return ok({
    ...image.value,
    reason,
    label: text(data.get("label")),
  });
}

export async function parseBannedImageTest(
  data: FormData,
): Promise<ParseResult<BannedImageTestInput>> {
  const image = await parseImageFile(data);
  if (!image.ok) return image;
  return ok(image.value);
}

function parsePerUserSlowRules(
  data: FormData,
): ParseResult<NonNullable<AutomodSettingsPatch["perUserSlow"]>["rules"]> {
  const raw = text(data.get("rules")) ?? "[]";
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return err("rules must be valid JSON.");
  }
  if (!Array.isArray(value)) return err("rules must be an array.");

  const rules: PerUserSlowRulePatch[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) {
      return err("Each slow rule needs a role, cooldownSeconds, and durationSeconds.");
    }
    const record = entry as Record<string, unknown>;
    const roleId = typeof record.roleId === "string" ? record.roleId.trim() : "";
    const cooldownSeconds = Number(record.cooldownSeconds);
    const durationSeconds = Number(record.durationSeconds);
    if (!roleId || !Number.isFinite(cooldownSeconds) || !Number.isFinite(durationSeconds)) {
      return err("Each slow rule needs a role, cooldownSeconds, and durationSeconds.");
    }
    rules.push({
      enabled: record.enabled !== false,
      roleId,
      cooldownSeconds: Math.trunc(cooldownSeconds),
      durationSeconds: Math.trunc(durationSeconds),
    });
  }
  if (rules.some((rule) => rule.cooldownSeconds < 1)) {
    return err("cooldownSeconds must be at least 1.");
  }
  if (rules.some((rule) => rule.durationSeconds < 60)) {
    return err("durationSeconds must be at least 60.");
  }
  return ok(rules);
}

export function parseModerationAction(
  data: FormData,
  moderatorId: string,
): ParseResult<ModerationBridgeAction> {
  const type = text(data.get("type"));
  const targetUserId = text(data.get("targetUserId"));
  const reason = text(data.get("reason")) ?? "No reason provided";
  if (!targetUserId) return err("targetUserId required");

  if (type === "warn" || type === "kick" || type === "ban" || type === "unban") {
    return ok({ type, moderatorId, targetUserId, reason });
  }
  if (type === "timeout") {
    const duration = positiveInt(data, "durationMs", 3_600_000);
    if (!duration.ok) return duration;
    return ok({ type, moderatorId, targetUserId, reason, durationMs: duration.value });
  }
  if (type === "restrict") {
    const roleId = text(data.get("roleId"));
    if (!roleId) return err("roleId required");
    return ok({ type, moderatorId, targetUserId, reason, roleId });
  }
  return err("Unknown moderation action");
}
