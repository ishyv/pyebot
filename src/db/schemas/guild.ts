/**
 * Guild document schema and latest defaults.
 *
 * tx is latest-only: missing fields receive explicit defaults for newly created
 * documents, but malformed old top-level config slices should fail validation
 * instead of being silently normalized.
 *
 * Feature-owned admin metadata lives in core/featureConfig.ts. This file owns
 * the durable shape and fallback policy only.
 */
import { z } from "zod";

// AI defaults (inlined — no external service import needed at schema level)
const DEFAULT_PROVIDER_ID = "gemini";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

const EconomySectorEnum = z.union([
  z.literal("global"), z.literal("works"), z.literal("trade"), z.literal("tax"),
]);

export const DailyConfigSchema = z.object({
  dailyReward: z.number().int().catch(250),
  dailyCooldownHours: z.number().int().catch(24),
  dailyCurrencyId: z.string().catch("coins"),
  dailyFeeRate: z.number().min(0).max(0.2).catch(0.0),
  dailyFeeSector: EconomySectorEnum.catch(() => "tax" as const),
  dailyStreakBonus: z.number().int().min(0).catch(5),
  dailyStreakCap: z.number().int().min(0).catch(10),
});

export const WorkConfigSchema = z.object({
  workRewardBase: z.number().int().catch(120),
  workBaseMintReward: z.number().int().min(0).catch(100),
  workBonusFromWorksMax: z.number().int().min(0).catch(100),
  workBonusScaleMode: z.enum(["flat", "percent"]).catch("flat"),
  workCooldownMinutes: z.number().int().catch(30),
  workDailyCap: z.number().int().catch(5),
  workCurrencyId: z.string().catch("coins"),
  workPaysFromSector: EconomySectorEnum.catch(() => "works" as const),
  workFailureChance: z.number().min(0).max(1).catch(0.1),
});

export enum Features {
  Tickets = "tickets",
  Automod = "automod",
  Autoroles = "autoroles",
  Warns = "warns",
  Roles = "roles",
  Reputation = "reputation",
  ReputationDetection = "reputationDetection",
  Tops = "tops",
  Suggest = "suggest",
  Economy = "economy",
  Game = "game",
  Counting = "counting",
}

export const DEFAULT_GUILD_FEATURES: Readonly<Record<Features, boolean>> = Object.freeze(
  Object.values(Features).reduce(
    (acc, key) => ({ ...acc, [key]: true }),
    {} as Record<Features, boolean>,
  ),
);

export const GuildFeaturesSchema = z.record(z.string(), z.boolean()).catch(() => DEFAULT_GUILD_FEATURES);

export type RoleCapabilityKey = string;
export type RoleCommandOverride = "inherit" | "allow" | "deny";
export type LimitWindow = `${number}${"m" | "h" | "d"}`;

export const RoleCommandOverrideSchema = z.enum(["inherit", "allow", "deny"]).catch("inherit");
export const RoleLimitSchema = z.object({
  limit: z.number().int().min(0).catch(0),
  window: z.custom<LimitWindow>((value) =>
    typeof value === "string" && /^\d+(m|h|d)$/.test(value),
  ).nullable().optional().catch(null),
  windowSeconds: z.number().int().min(0).nullable().optional().catch(null),
});
export const GuildRoleSchema = z.object({
  label: z.string().catch("Managed role"),
  discordRoleId: z.string().nullable().catch(null),
  reach: z.record(z.string(), RoleCommandOverrideSchema).catch(() => ({})),
  limits: z.record(z.string(), RoleLimitSchema).catch(() => ({})),
  updatedBy: z.string().nullable().catch(null),
  updatedAt: z.string().nullable().catch(null),
}).passthrough();
export const GuildRolesSchema = z.record(z.string(), GuildRoleSchema).catch(() => ({}));

export const CoreChannelSchema = z.object({ channelId: z.string() });
export const ManagedChannelSchema = z.object({ id: z.string(), label: z.string(), channelId: z.string() });

// Keep core channel defaults explicit so admin panels, migrations, and docs can
// distinguish an unset known slot from an arbitrary managed channel.
const defaultCoreChannels = () => ({
  welcome: null,
  goodbye: null,
  logs: null,
  reports: null,
  suggestions: null,
  tickets: null,
  messageLogs: null,
  voiceLogs: null,
  ticketLogs: null,
  ticketCategory: null,
  pointsLog: null,
  generalLogs: null,
  banSanctions: null,
  staff: null,
  repRequests: null,
  offersReview: null,
  approvedOffers: null,
});

export const GuildChannelsSchema = z.object({
  core: z.record(z.string(), CoreChannelSchema.nullable()).catch(() => defaultCoreChannels()),
  managed: z.record(z.string(), ManagedChannelSchema).catch(() => ({})),
  ticketMessageId: z.string().nullable().catch(null),
  ticketHelperRoles: z.array(z.string()).catch(() => []),
  ticketCategoryId: z.string().nullable().catch(null),
});

export const ForumAutoReplySchema = z.object({
  enabled: z.boolean().catch(false),
  forumIds: z.array(z.string()).catch(() => []),
});
export const AiConfigSchema = z.object({
  provider: z.string().catch(DEFAULT_PROVIDER_ID),
  model: z.string().catch(DEFAULT_GEMINI_MODEL),
  rateLimit: z.object({
    perUserPerMinute: z.number().int().min(0).catch(8),
    perGuildPerMinute: z.number().int().min(0).catch(60),
  }).catch(() => ({ perUserPerMinute: 8, perGuildPerMinute: 60 })),
});

export const ReputationConfigSchema = z.object({
  keywords: z.array(z.string()).catch(() => []),
  detectionEnabled: z.boolean().catch(false),
  requestChannelId: z.string().nullable().catch(null),
}).catch(() => ({ keywords: [], detectionEnabled: false, requestChannelId: null }));

export const TopsConfigSchema = z.object({
  enabled: z.boolean().catch(false),
  channelId: z.string().nullable().catch(null),
  intervalHours: z.number().int().min(1).catch(24),
  topSize: z.number().int().min(1).max(25).catch(10),
}).catch(() => ({ enabled: false, channelId: null, intervalHours: 24, topSize: 10 }));

export const OffersConfigSchema = z.object({
  reviewChannelId: z.string().nullable().catch(null),
  approvedChannelId: z.string().nullable().catch(null),
}).catch(() => ({ reviewChannelId: null, approvedChannelId: null }));

export const CountingConfigSchema = z.object({
  channelId: z.string().nullable().catch(null),
}).catch(() => ({ channelId: null }));

// ─── Automod ─────────────────────────────────────────────────────────────────

export const AutomodSchema = z.object({
  linkSpam: z.object({
    enabled: z.boolean().catch(false),
    maxLinks: z.number().int().catch(4),
    windowSeconds: z.number().int().catch(10),
    timeoutSeconds: z.number().int().catch(300),
    action: z.enum(["timeout", "mute", "delete", "report"]).catch("timeout"),
    reportChannelId: z.string().nullable().catch(null),
  }).catch(() => ({ enabled: false, maxLinks: 4, windowSeconds: 10, timeoutSeconds: 300, action: "timeout" as const, reportChannelId: null })),
  domainWhitelist: z.object({
    enabled: z.boolean().catch(false),
    domains: z.array(z.string()).catch(() => []),
  }).catch(() => ({ enabled: false, domains: [] })),
  shorteners: z.object({
    enabled: z.boolean().catch(false),
    resolveFinalUrl: z.boolean().catch(false),
    allowedShorteners: z.array(z.string()).catch(() => ["bit.ly", "t.co", "tinyurl.com", "cutt.ly", "is.gd", "rebrand.ly", "goo.gl"]),
  }).catch(() => ({ enabled: false, resolveFinalUrl: false, allowedShorteners: ["bit.ly", "t.co", "tinyurl.com", "cutt.ly", "is.gd", "rebrand.ly", "goo.gl"] })),
  crossChannelSpam: z.object({
    enabled: z.boolean().catch(false),
    minChannels: z.number().int().catch(3),
    windowSeconds: z.number().int().catch(30),
    reportChannelId: z.string().nullable().catch(null),
    autoTimeout: z.boolean().catch(true),
    timeoutSeconds: z.number().int().catch(3600),
  }).catch(() => ({ enabled: false, minChannels: 3, windowSeconds: 30, reportChannelId: null, autoTimeout: true, timeoutSeconds: 3600 })),
  mentionSpam: z.object({
    enabled: z.boolean().catch(false),
    maxMentions: z.number().int().catch(5),
    windowSeconds: z.number().int().catch(10),
    action: z.enum(["timeout", "delete", "report"]).catch("timeout"),
    timeoutSeconds: z.number().int().catch(600),
    reportChannelId: z.string().nullable().catch(null),
  }).catch(() => ({ enabled: false, maxMentions: 5, windowSeconds: 10, action: "timeout" as const, timeoutSeconds: 600, reportChannelId: null })),
  slowmode: z.object({
    enabled: z.boolean().catch(false),
    messagesPerWindow: z.number().int().catch(20),
    windowSeconds: z.number().int().catch(60),
    slowmodeSeconds: z.number().int().catch(5),
    releaseAfterSeconds: z.number().int().catch(60),
  }).catch(() => ({ enabled: false, messagesPerWindow: 20, windowSeconds: 60, slowmodeSeconds: 5, releaseAfterSeconds: 60 })),
  raidDetection: z.object({
    enabled: z.boolean().catch(false),
    joinsPerMinute: z.number().int().catch(10),
    minAccountAgeDays: z.number().int().catch(7),
    action: z.enum(["alert", "lockdown", "quarantine"]).catch("alert"),
    reportChannelId: z.string().nullable().catch(null),
  }).catch(() => ({ enabled: false, joinsPerMinute: 10, minAccountAgeDays: 7, action: "alert" as const, reportChannelId: null })),
  customPatterns: z.array(z.object({
    name: z.string(),
    pattern: z.string(),
    flags: z.string().catch("i"),
    action: z.enum(["delete", "timeout", "report"]).catch("delete"),
    timeoutSeconds: z.number().int().catch(300),
  })).catch(() => []),
  policy: z.object({
    preset: z.enum(["relaxed", "balanced", "strict"]).catch("balanced"),
    profileRetentionDays: z.number().int().min(1).max(365).catch(30),
    aiDetector: z.object({
      enabled: z.boolean().catch(false),
      minConfidence: z.number().min(0).max(1).catch(0.75),
    }).catch(() => ({ enabled: false, minConfidence: 0.75 })),
    bypass: z.object({
      staffBypass: z.boolean().catch(true),
      ignoredChannelIds: z.array(z.string()).catch(() => []),
      strictChannelIds: z.array(z.string()).catch(() => []),
      trustedRoleIds: z.array(z.string()).catch(() => []),
      protectedRoleIds: z.array(z.string()).catch(() => []),
    }).catch(() => ({
      staffBypass: true,
      ignoredChannelIds: [],
      strictChannelIds: [],
      trustedRoleIds: [],
      protectedRoleIds: [],
    })),
    alertRateLimit: z.object({
      windowSeconds: z.number().int().min(1).catch(60),
      maxAlerts: z.number().int().min(1).catch(4),
    }).catch(() => ({ windowSeconds: 60, maxAlerts: 4 })),
    actionRateLimit: z.object({
      windowSeconds: z.number().int().min(1).catch(60),
      maxActions: z.number().int().min(1).catch(3),
    }).catch(() => ({ windowSeconds: 60, maxActions: 3 })),
  }).catch(() => ({
    preset: "balanced" as const,
    profileRetentionDays: 30,
    aiDetector: { enabled: false, minConfidence: 0.75 },
    bypass: {
      staffBypass: true,
      ignoredChannelIds: [],
      strictChannelIds: [],
      trustedRoleIds: [],
      protectedRoleIds: [],
    },
    alertRateLimit: { windowSeconds: 60, maxAlerts: 4 },
    actionRateLimit: { windowSeconds: 60, maxActions: 3 },
  })),
}).catch(() => ({
  linkSpam: { enabled: false, maxLinks: 4, windowSeconds: 10, timeoutSeconds: 300, action: "timeout" as const, reportChannelId: null },
  domainWhitelist: { enabled: false, domains: [] },
  shorteners: { enabled: false, resolveFinalUrl: false, allowedShorteners: ["bit.ly", "t.co", "tinyurl.com"] },
  crossChannelSpam: { enabled: false, minChannels: 3, windowSeconds: 30, reportChannelId: null, autoTimeout: true, timeoutSeconds: 3600 },
  mentionSpam: { enabled: false, maxMentions: 5, windowSeconds: 10, action: "timeout" as const, timeoutSeconds: 600, reportChannelId: null },
  slowmode: { enabled: false, messagesPerWindow: 20, windowSeconds: 60, slowmodeSeconds: 5, releaseAfterSeconds: 60 },
  raidDetection: { enabled: false, joinsPerMinute: 10, minAccountAgeDays: 7, action: "alert" as const, reportChannelId: null },
  customPatterns: [],
  policy: {
    preset: "balanced" as const,
    profileRetentionDays: 30,
    aiDetector: { enabled: false, minConfidence: 0.75 },
    bypass: {
      staffBypass: true,
      ignoredChannelIds: [],
      strictChannelIds: [],
      trustedRoleIds: [],
      protectedRoleIds: [],
    },
    alertRateLimit: { windowSeconds: 60, maxAlerts: 4 },
    actionRateLimit: { windowSeconds: 60, maxActions: 3 },
  },
}));

// ─── Moderation config ────────────────────────────────────────────────────────

export const EscalationThresholdSchema = z.object({
  warnCount: z.number().int(),
  action: z.enum(["timeout", "kick", "ban"]),
  durationKey: z.string().optional(), // e.g. "1h", "1d" — used when action is "timeout"
});
export type EscalationThreshold = z.infer<typeof EscalationThresholdSchema>;

export const ModerationConfigSchema = z.object({
  modLogChannelId: z.string().nullable().catch(null),
  appealsChannelId: z.string().nullable().catch(null),
  appealsQueueMessageId: z.string().nullable().catch(null),
  altDetectionEnabled: z.boolean().catch(false),
  escalation: z.object({
    enabled: z.boolean().catch(false),
    thresholds: z.array(EscalationThresholdSchema).catch(() => []),
  }).catch(() => ({ enabled: false, thresholds: [] })),
  tempBanCheckIntervalMs: z.number().int().catch(60_000),
  quarantine: z.object({
    enabled: z.boolean().catch(false),
    roleId: z.string().nullable().catch(null),
    channelId: z.string().nullable().catch(null),
  }).catch(() => ({ enabled: false, roleId: null, channelId: null })),
  verification: z.object({
    enabled: z.boolean().catch(false),
    mode: z.enum(["button", "account_age"]).catch("button"),
    minAccountAgeDays: z.number().int().catch(0),
    channelId: z.string().nullable().catch(null),
    roleId: z.string().nullable().catch(null),
    kickOnFail: z.boolean().catch(false),
  }).catch(() => ({
    enabled: false,
    mode: "button" as const,
    minAccountAgeDays: 0,
    channelId: null,
    roleId: null,
    kickOnFail: false,
  })),
  restrictionRoles: z.object({
    forums: z.string().nullable().catch(null),
    voice:  z.string().nullable().catch(null),
    jobs:   z.string().nullable().catch(null),
    all:    z.string().nullable().catch(null),
  }).catch(() => ({ forums: null, voice: null, jobs: null, all: null })),
}).catch(() => ({
  modLogChannelId: null,
  appealsChannelId: null,
  appealsQueueMessageId: null,
  altDetectionEnabled: false,
  escalation: { enabled: false, thresholds: [] },
  tempBanCheckIntervalMs: 60_000,
  quarantine: { enabled: false, roleId: null, channelId: null },
  verification: { enabled: false, mode: "button" as const, minAccountAgeDays: 0, channelId: null, roleId: null, kickOnFail: false },
  restrictionRoles: { forums: null, voice: null, jobs: null, all: null },
}));

// ─── Guild document ───────────────────────────────────────────────────────────

export const GuildSchema = z.object({
  _id: z.string(),
  roles: GuildRolesSchema,
  channels: GuildChannelsSchema.default(() => ({
    core: defaultCoreChannels(),
    managed: {},
    ticketMessageId: null,
    ticketHelperRoles: [],
    ticketCategoryId: null,
  })),
  pendingTickets: z.array(z.string()).catch(() => []),
  features: GuildFeaturesSchema,
  forumAutoReply: ForumAutoReplySchema.catch(() => ({ enabled: false, forumIds: [] })),
  ai: AiConfigSchema.catch(() => ({
    provider: DEFAULT_PROVIDER_ID,
    model: DEFAULT_GEMINI_MODEL,
    rateLimit: { perUserPerMinute: 8, perGuildPerMinute: 60 },
  })),
  reputation: ReputationConfigSchema,
  tops: TopsConfigSchema,
  offersConfig: OffersConfigSchema,
  counting: CountingConfigSchema,
  automod: AutomodSchema,
  moderation: ModerationConfigSchema,
  nextCaseId: z.number().int().catch(1),
  economy: z.object({
    features: z.object({
      coinflip: z.boolean().catch(true),
      trivia: z.boolean().catch(true),
      rob: z.boolean().catch(true),
      voting: z.boolean().catch(true),
      crafting: z.boolean().catch(true),
      store: z.boolean().catch(true),
    }).catch(() => ({
      coinflip: true,
      trivia: true,
      rob: true,
      voting: true,
      crafting: true,
      store: true,
    })),
    tax: z.object({
      enabled: z.boolean().catch(false),
      rate: z.number().min(0).max(1).catch(0.05),
      minimumTaxableAmount: z.number().int().min(0).catch(100),
      taxSector: EconomySectorEnum.catch(() => "tax" as const),
    }).catch(() => ({ enabled: false, rate: 0.05, minimumTaxableAmount: 100, taxSector: "tax" as const })),
    thresholds: z.object({
      warning: z.number().int().min(0).catch(5_000),
      alert: z.number().int().min(0).catch(25_000),
      critical: z.number().int().min(0).catch(100_000),
    }).catch(() => ({ warning: 5_000, alert: 25_000, critical: 100_000 })),
    daily: DailyConfigSchema.catch(() => ({ dailyReward: 250, dailyCooldownHours: 24, dailyCurrencyId: "coins", dailyFeeRate: 0, dailyFeeSector: "tax" as const, dailyStreakBonus: 5, dailyStreakCap: 10 })),
    work: WorkConfigSchema.catch(() => ({ workRewardBase: 120, workBaseMintReward: 100, workBonusFromWorksMax: 100, workBonusScaleMode: "flat" as const, workCooldownMinutes: 30, workDailyCap: 5, workCurrencyId: "coins", workPaysFromSector: "works" as const, workFailureChance: 0.1 })),
    progression: z.object({
      enabled: z.boolean().catch(true),
      xpAmounts: z.record(z.string(), z.number().int().min(0)).catch(() => ({
        daily_claim: 60,
        work_claim: 25,
        store_buy: 15,
        store_sell: 10,
        quest_complete: 120,
        craft: 10,
      })),
      cooldownSeconds: z.record(z.string(), z.number().int().min(0)).catch(() => ({
        daily_claim: 0,
        work_claim: 0,
        store_buy: 15,
        store_sell: 15,
        quest_complete: 0,
        craft: 0,
      })),
    }).catch(() => ({
      enabled: true,
      xpAmounts: { daily_claim: 60, work_claim: 25, store_buy: 15, store_sell: 10, quest_complete: 120, craft: 10 },
      cooldownSeconds: { daily_claim: 0, work_claim: 0, store_buy: 15, store_sell: 15, quest_complete: 0, craft: 0 },
    })),
    sectors: z.object({ global: z.number().catch(0), works: z.number().catch(0), trade: z.number().catch(0), tax: z.number().catch(0) }).optional().catch(() => ({ global: 0, works: 0, trade: 0, tax: 0 })),
  }).catch(() => ({
    features: { coinflip: true, trivia: true, rob: true, voting: true, crafting: true, store: true },
    tax: { enabled: false, rate: 0.05, minimumTaxableAmount: 100, taxSector: "tax" as const },
    thresholds: { warning: 5_000, alert: 25_000, critical: 100_000 },
    daily: { dailyReward: 250, dailyCooldownHours: 24, dailyCurrencyId: "coins", dailyFeeRate: 0, dailyFeeSector: "tax" as const, dailyStreakBonus: 5, dailyStreakCap: 10 },
    work: { workRewardBase: 120, workBaseMintReward: 100, workBonusFromWorksMax: 100, workBonusScaleMode: "flat" as const, workCooldownMinutes: 30, workDailyCap: 5, workCurrencyId: "coins", workPaysFromSector: "works" as const, workFailureChance: 0.1 },
    progression: {
      enabled: true,
      xpAmounts: { daily_claim: 60, work_claim: 25, store_buy: 15, store_sell: 10, quest_complete: 120, craft: 10 },
      cooldownSeconds: { daily_claim: 0, work_claim: 0, store_buy: 15, store_sell: 15, quest_complete: 0, craft: 0 },
    },
  })),
  createdAt: z.coerce.date().optional().catch(() => undefined),
  updatedAt: z.coerce.date().optional().catch(() => undefined),
});

export type Guild = z.infer<typeof GuildSchema>;
export type GuildChannelsRecord = z.infer<typeof GuildChannelsSchema>;
export type GuildFeaturesRecord = z.infer<typeof GuildFeaturesSchema>;
export type AiConfigRecord = z.infer<typeof AiConfigSchema>;
export type ModerationConfig = z.infer<typeof ModerationConfigSchema>;
export type AutomodConfig = z.infer<typeof AutomodSchema>;
export type GuildRoleRecord = z.infer<typeof GuildRoleSchema>;
export type RoleLimitRecord = z.infer<typeof RoleLimitSchema>;
export type ReputationConfig = z.infer<typeof ReputationConfigSchema>;
export type TopsConfig = z.infer<typeof TopsConfigSchema>;
export type CountingConfig = z.infer<typeof CountingConfigSchema>;
