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
}

export const DEFAULT_GUILD_FEATURES: Readonly<Record<Features, boolean>> = Object.freeze(
  Object.values(Features).reduce(
    (acc, key) => ({ ...acc, [key]: true }),
    {} as Record<Features, boolean>,
  ),
);

export const GuildFeaturesSchema = z.record(z.string(), z.boolean()).catch(() => DEFAULT_GUILD_FEATURES);

export const CoreChannelSchema = z.object({ channelId: z.string() });
export const ManagedChannelSchema = z.object({ id: z.string(), label: z.string(), channelId: z.string() });

export const ModerationConfigSchema = z.object({
  restrictionRoles: z.object({
    forums: z.string().nullable().catch(null),
    voice:  z.string().nullable().catch(null),
    jobs:   z.string().nullable().catch(null),
    all:    z.string().nullable().catch(null),
  }).catch(() => ({ forums: null, voice: null, jobs: null, all: null })),
  escalation: z.object({
    enabled:        z.boolean().catch(false),
    warnThreshold:  z.number().int().catch(3),
    muteDurationMs: z.number().int().catch(3_600_000),
  }).catch(() => ({ enabled: false, warnThreshold: 3, muteDurationMs: 3_600_000 })),
}).catch(() => ({ restrictionRoles: { forums: null, voice: null, jobs: null, all: null }, escalation: { enabled: false, warnThreshold: 3, muteDurationMs: 3_600_000 } }));

export type ModerationConfig = z.infer<typeof ModerationConfigSchema>;

export const GuildChannelsSchema = z.object({
  core: z.record(z.string(), CoreChannelSchema.nullable()).catch(() => ({
    welcome: null, goodbye: null, logs: null, reports: null, suggestions: null, tickets: null, modlog: null,
  })),
  managed: z.record(z.string(), ManagedChannelSchema).catch(() => ({})),
  ticketMessageId: z.string().nullable().catch(null),
  ticketHelperRoles: z.array(z.string()).catch(() => []),
  ticketCategoryId: z.string().nullable().catch(null),
});

export const ForumAutoReplySchema = z.object({ forumIds: z.array(z.string()).catch(() => []) });
export const AiConfigSchema = z.object({
  provider: z.string().catch(DEFAULT_PROVIDER_ID),
  model: z.string().catch(DEFAULT_GEMINI_MODEL),
});

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
}).catch(() => ({
  linkSpam: { enabled: false, maxLinks: 4, windowSeconds: 10, timeoutSeconds: 300, action: "timeout" as const, reportChannelId: null },
  domainWhitelist: { enabled: false, domains: [] },
  shorteners: { enabled: false, resolveFinalUrl: false, allowedShorteners: ["bit.ly", "t.co", "tinyurl.com"] },
}));

export const GuildSchema = z.object({
  _id: z.string(),
  roles: z.record(z.string(), z.unknown()).catch(() => ({})),
  channels: GuildChannelsSchema.catch(() => ({
    core: { welcome: null, goodbye: null, logs: null, reports: null, suggestions: null, tickets: null, modlog: null },
    managed: {},
    ticketMessageId: null,
    ticketHelperRoles: [],
    ticketCategoryId: null,
  })),
  pendingTickets: z.array(z.string()).catch(() => []),
  features: GuildFeaturesSchema,
  forumAutoReply: ForumAutoReplySchema.catch(() => ({ forumIds: [] })),
  ai: AiConfigSchema.catch(() => ({ provider: DEFAULT_PROVIDER_ID, model: DEFAULT_GEMINI_MODEL })),
  reputation: z.object({ keywords: z.array(z.string()).catch(() => []) }).catch(() => ({ keywords: [] })),
  automod: AutomodSchema,
  moderation: ModerationConfigSchema,
  economy: z.object({
    daily: DailyConfigSchema.catch(() => ({ dailyReward: 250, dailyCooldownHours: 24, dailyCurrencyId: "coins", dailyFeeRate: 0, dailyFeeSector: "tax" as const, dailyStreakBonus: 5, dailyStreakCap: 10 })),
    work: WorkConfigSchema.catch(() => ({ workRewardBase: 120, workBaseMintReward: 100, workBonusFromWorksMax: 100, workBonusScaleMode: "flat" as const, workCooldownMinutes: 30, workDailyCap: 5, workCurrencyId: "coins", workPaysFromSector: "works" as const, workFailureChance: 0.1 })),
    sectors: z.object({ global: z.number().catch(0), works: z.number().catch(0), trade: z.number().catch(0), tax: z.number().catch(0) }).optional().catch(() => ({ global: 0, works: 0, trade: 0, tax: 0 })),
  }).catch(() => ({
    daily: { dailyReward: 250, dailyCooldownHours: 24, dailyCurrencyId: "coins", dailyFeeRate: 0, dailyFeeSector: "tax" as const, dailyStreakBonus: 5, dailyStreakCap: 10 },
    work: { workRewardBase: 120, workBaseMintReward: 100, workBonusFromWorksMax: 100, workBonusScaleMode: "flat" as const, workCooldownMinutes: 30, workDailyCap: 5, workCurrencyId: "coins", workPaysFromSector: "works" as const, workFailureChance: 0.1 },
  })),
  createdAt: z.coerce.date().optional().catch(() => undefined),
  updatedAt: z.coerce.date().optional().catch(() => undefined),
});

export type Guild = z.infer<typeof GuildSchema>;
export type GuildChannelsRecord = z.infer<typeof GuildChannelsSchema>;
export type GuildFeaturesRecord = z.infer<typeof GuildFeaturesSchema>;
export type AiConfigRecord = z.infer<typeof AiConfigSchema>;
