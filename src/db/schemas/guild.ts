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
import {
  AutomodSchema,
  type PerUserSlowRuleSchema,
  type PerUserSlowSchema,
  type TempRoleAccessRuleSchema,
  type TempRoleMessageRuleSchema,
  type TempRolePolicySchema,
} from "./guild/automod";
import { EconomyConfigSchema } from "./guild/economy";
import { ModerationConfigSchema } from "./guild/moderation";

export * from "./guild/automod";
export * from "./guild/economy";
export * from "./guild/moderation";

// AI defaults (inlined — no external service import needed at schema level)
const DEFAULT_PROVIDER_ID = "gemini";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export type RoleCapabilityKey = string;
export type RoleCommandOverride = "inherit" | "allow" | "deny";
export type LimitWindow = `${number}${"m" | "h" | "d"}`;

export const RoleCommandOverrideSchema = z.enum(["inherit", "allow", "deny"]).catch("inherit");
export const RoleLimitSchema = z.object({
  limit: z.number().int().min(0).catch(0),
  window: z
    .custom<LimitWindow>((value) => typeof value === "string" && /^\d+(m|h|d)$/.test(value))
    .nullable()
    .optional()
    .catch(null),
  windowSeconds: z.number().int().min(0).nullable().optional().catch(null),
});
export const GuildRoleSchema = z
  .object({
    label: z.string().catch("Managed role"),
    discordRoleId: z.string().nullable().catch(null),
    reach: z.record(z.string(), RoleCommandOverrideSchema).catch(() => ({})),
    limits: z.record(z.string(), RoleLimitSchema).catch(() => ({})),
    updatedBy: z.string().nullable().catch(null),
    updatedAt: z.string().nullable().catch(null),
  })
  .passthrough();
export const GuildRolesSchema = z.record(z.string(), GuildRoleSchema).catch(() => ({}));

export const CoreChannelSchema = z.object({ channelId: z.string() });
export const ManagedChannelSchema = z.object({
  id: z.string(),
  label: z.string(),
  channelId: z.string(),
});

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
  rateLimit: z
    .object({
      perUserPerMinute: z.number().int().min(0).catch(8),
      perGuildPerMinute: z.number().int().min(0).catch(60),
    })
    .catch(() => ({ perUserPerMinute: 8, perGuildPerMinute: 60 })),
});

export const ReputationConfigSchema = z
  .object({
    keywords: z.array(z.string()).catch(() => []),
    detectionEnabled: z.boolean().catch(false),
    requestChannelId: z.string().nullable().catch(null),
  })
  .catch(() => ({ keywords: [], detectionEnabled: false, requestChannelId: null }));

export const TopsConfigSchema = z
  .object({
    enabled: z.boolean().catch(false),
    channelId: z.string().nullable().catch(null),
    intervalHours: z.number().int().min(1).catch(24),
    topSize: z.number().int().min(1).max(25).catch(10),
  })
  .catch(() => ({ enabled: false, channelId: null, intervalHours: 24, topSize: 10 }));

export const OffersConfigSchema = z
  .object({
    reviewChannelId: z.string().nullable().catch(null),
    approvedChannelId: z.string().nullable().catch(null),
  })
  .catch(() => ({ reviewChannelId: null, approvedChannelId: null }));

export const CountingConfigSchema = z
  .object({
    channelId: z.string().nullable().catch(null),
  })
  .catch(() => ({ channelId: null }));

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
  automod: AutomodSchema.default(() => AutomodSchema.parse({})),
  moderation: ModerationConfigSchema,
  nextCaseId: z.number().int().catch(1),
  economy: EconomyConfigSchema,
  createdAt: z.coerce
    .date()
    .optional()
    .catch(() => undefined),
  updatedAt: z.coerce
    .date()
    .optional()
    .catch(() => undefined),
});

export type Guild = z.infer<typeof GuildSchema>;
export type GuildChannelsRecord = z.infer<typeof GuildChannelsSchema>;
export type AiConfigRecord = z.infer<typeof AiConfigSchema>;
export type ModerationConfig = z.infer<typeof ModerationConfigSchema>;
export type AutomodConfig = z.infer<typeof AutomodSchema>;
export type TempRolePolicyConfig = z.infer<typeof TempRolePolicySchema>;
export type TempRoleMessageRule = z.infer<typeof TempRoleMessageRuleSchema>;
export type TempRoleAccessRule = z.infer<typeof TempRoleAccessRuleSchema>;
export type PerUserSlowConfig = z.infer<typeof PerUserSlowSchema>;
export type PerUserSlowRuleConfig = z.infer<typeof PerUserSlowRuleSchema>;
export type GuildRoleRecord = z.infer<typeof GuildRoleSchema>;
export type RoleLimitRecord = z.infer<typeof RoleLimitSchema>;
export type ReputationConfig = z.infer<typeof ReputationConfigSchema>;
export type TopsConfig = z.infer<typeof TopsConfigSchema>;
export type CountingConfig = z.infer<typeof CountingConfigSchema>;
