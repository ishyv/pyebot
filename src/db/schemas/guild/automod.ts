import { z } from "zod";

export const TempRoleMessageRuleKindSchema = z.enum([
  "links",
  "media",
  "mentions",
  "invites",
  "repeatedText",
  "caps",
  "crossChannel",
  "shortLinks",
  "regex",
]);

export const TempRoleMessageRuleActionSchema = z.enum(["report", "delete", "timeout"]);

export const TempRoleMessageRuleSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean().catch(true),
  kind: TempRoleMessageRuleKindSchema.catch("links"),
  action: TempRoleMessageRuleActionSchema.catch("report"),
  channelIds: z.array(z.string()).catch(() => []),
  categoryIds: z.array(z.string()).catch(() => []),
  limit: z.number().int().min(1).nullable().catch(null),
  windowSeconds: z.number().int().min(1).nullable().catch(null),
  timeoutSeconds: z.number().int().min(1).catch(300),
  pattern: z.string().nullable().catch(null),
});

export const TempRoleAccessRuleSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean().catch(true),
  targetId: z.string().min(1),
  targetType: z.enum(["channel", "category"]).catch("channel"),
  mode: z.enum(["view", "send"]).catch("send"),
});

const defaultRecentlyJoinedPolicy = () => ({
  enabled: false,
  roleId: null,
  durationSeconds: 7 * 24 * 60 * 60,
  maxAccountAgeDays: 14,
  skipRoleIds: [],
  reportChannelId: null,
  messageRules: [],
  accessRules: [],
});

export const TempRolePolicySchema = z
  .object({
    enabled: z.boolean().catch(false),
    roleId: z.string().nullable().catch(null),
    durationSeconds: z
      .number()
      .int()
      .min(60)
      .catch(7 * 24 * 60 * 60),
    maxAccountAgeDays: z.number().int().min(0).max(365).catch(14),
    skipRoleIds: z.array(z.string()).catch(() => []),
    reportChannelId: z.string().nullable().catch(null),
    messageRules: z.array(TempRoleMessageRuleSchema).default([]),
    accessRules: z.array(TempRoleAccessRuleSchema).default([]),
  })
  .catch(() => defaultRecentlyJoinedPolicy());

export const TempRolePoliciesSchema = z
  .object({
    recentlyJoined: TempRolePolicySchema.catch(() => defaultRecentlyJoinedPolicy()),
  })
  .catch(() => ({ recentlyJoined: defaultRecentlyJoinedPolicy() }));

const defaultPerUserSlow = () => ({
  enabled: false,
  rules: [],
});

const defaultImageDetection = () => ({
  enabled: false,
  reportChannelId: null,
  tolerance: "balanced" as const,
});

export const PerUserSlowRuleSchema = z.object({
  enabled: z.boolean().catch(true),
  roleId: z.string().catch(""),
  cooldownSeconds: z.number().int().min(1).catch(30),
  durationSeconds: z
    .number()
    .int()
    .min(60)
    .catch(60 * 60),
});

export const PerUserSlowSchema = z
  .object({
    enabled: z.boolean().catch(false),
    rules: z.array(PerUserSlowRuleSchema).catch(() => []),
  })
  .catch(() => defaultPerUserSlow());

export const AutomodTextRuleSchema = z
  .object({
    id: z.string().min(1),
    enabled: z.boolean().catch(true),
    phrase: z.string().optional(),
    phrases: z.array(z.string()).catch(() => []),
    action: z.enum(["delete", "timeout", "report"]).catch("delete"),
    timeoutSeconds: z.number().int().min(60).catch(300),
  })
  .transform((rule, ctx) => {
    const phrases = [...rule.phrases, ...(rule.phrase ? [rule.phrase] : [])]
      .map((phrase) => phrase.trim())
      .filter(Boolean)
      .filter((phrase, index, all) => all.indexOf(phrase) === index);

    if (phrases.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Text rules require at least one phrase.",
      });
      return z.NEVER;
    }

    return {
      id: rule.id,
      enabled: rule.enabled,
      phrases,
      action: rule.action,
      timeoutSeconds: rule.timeoutSeconds,
    };
  });

export const AutomodSchema = z.object({
  linkSpam: z
    .object({
      enabled: z.boolean().catch(false),
      maxLinks: z.number().int().catch(4),
      windowSeconds: z.number().int().catch(10),
      timeoutSeconds: z.number().int().catch(300),
      action: z.enum(["timeout", "mute", "delete", "report"]).catch("timeout"),
      reportChannelId: z.string().nullable().catch(null),
    })
    .catch(() => ({
      enabled: false,
      maxLinks: 4,
      windowSeconds: 10,
      timeoutSeconds: 300,
      action: "timeout" as const,
      reportChannelId: null,
    })),
  domainWhitelist: z
    .object({
      enabled: z.boolean().catch(false),
      domains: z.array(z.string()).catch(() => []),
    })
    .catch(() => ({ enabled: false, domains: [] })),
  shorteners: z
    .object({
      enabled: z.boolean().catch(false),
      resolveFinalUrl: z.boolean().catch(false),
      allowedShorteners: z
        .array(z.string())
        .catch(() => ["bit.ly", "t.co", "tinyurl.com", "cutt.ly", "is.gd", "rebrand.ly", "goo.gl"]),
    })
    .catch(() => ({
      enabled: false,
      resolveFinalUrl: false,
      allowedShorteners: [
        "bit.ly",
        "t.co",
        "tinyurl.com",
        "cutt.ly",
        "is.gd",
        "rebrand.ly",
        "goo.gl",
      ],
    })),
  crossChannelSpam: z
    .object({
      enabled: z.boolean().catch(false),
      minChannels: z.number().int().catch(3),
      windowSeconds: z.number().int().catch(30),
      reportChannelId: z.string().nullable().catch(null),
      autoTimeout: z.boolean().catch(true),
      timeoutSeconds: z.number().int().catch(3600),
    })
    .catch(() => ({
      enabled: false,
      minChannels: 3,
      windowSeconds: 30,
      reportChannelId: null,
      autoTimeout: true,
      timeoutSeconds: 3600,
    })),
  mentionSpam: z
    .object({
      enabled: z.boolean().catch(false),
      maxMentions: z.number().int().catch(5),
      windowSeconds: z.number().int().catch(10),
      action: z.enum(["timeout", "delete", "report"]).catch("timeout"),
      timeoutSeconds: z.number().int().catch(600),
      reportChannelId: z.string().nullable().catch(null),
    })
    .catch(() => ({
      enabled: false,
      maxMentions: 5,
      windowSeconds: 10,
      action: "timeout" as const,
      timeoutSeconds: 600,
      reportChannelId: null,
    })),
  slowmode: z
    .object({
      enabled: z.boolean().catch(false),
      messagesPerWindow: z.number().int().catch(20),
      windowSeconds: z.number().int().catch(60),
      slowmodeSeconds: z.number().int().catch(5),
      releaseAfterSeconds: z.number().int().catch(60),
    })
    .catch(() => ({
      enabled: false,
      messagesPerWindow: 20,
      windowSeconds: 60,
      slowmodeSeconds: 5,
      releaseAfterSeconds: 60,
    })),
  raidDetection: z
    .object({
      enabled: z.boolean().catch(false),
      joinsPerMinute: z.number().int().catch(10),
      minAccountAgeDays: z.number().int().catch(7),
      action: z.enum(["alert", "lockdown", "quarantine"]).catch("alert"),
      reportChannelId: z.string().nullable().catch(null),
    })
    .catch(() => ({
      enabled: false,
      joinsPerMinute: 10,
      minAccountAgeDays: 7,
      action: "alert" as const,
      reportChannelId: null,
    })),
  customPatterns: z
    .array(
      z.object({
        name: z.string(),
        pattern: z.string(),
        flags: z.string().catch("i"),
        action: z.enum(["delete", "timeout", "report"]).catch("delete"),
        timeoutSeconds: z.number().int().catch(300),
      }),
    )
    .catch(() => []),
  textRules: z.array(AutomodTextRuleSchema).catch(() => []),
  tempRolePolicies: TempRolePoliciesSchema.catch(() => ({
    recentlyJoined: defaultRecentlyJoinedPolicy(),
  })),
  perUserSlow: PerUserSlowSchema.catch(() => defaultPerUserSlow()),
  imageDetection: z
    .object({
      enabled: z.boolean().catch(false),
      reportChannelId: z.string().nullable().catch(null),
      tolerance: z.enum(["strict", "balanced", "loose"]).catch("balanced"),
    })
    .catch(() => defaultImageDetection()),
  policy: z
    .object({
      preset: z.enum(["relaxed", "balanced", "strict"]).catch("balanced"),
      profileRetentionDays: z.number().int().min(1).max(365).catch(30),
      aiDetector: z
        .object({
          enabled: z.boolean().catch(false),
          minConfidence: z.number().min(0).max(1).catch(0.75),
        })
        .catch(() => ({ enabled: false, minConfidence: 0.75 })),
      bypass: z
        .object({
          staffBypass: z.boolean().catch(true),
          ignoredChannelIds: z.array(z.string()).catch(() => []),
          strictChannelIds: z.array(z.string()).catch(() => []),
          trustedRoleIds: z.array(z.string()).catch(() => []),
          protectedRoleIds: z.array(z.string()).catch(() => []),
        })
        .catch(() => ({
          staffBypass: true,
          ignoredChannelIds: [],
          strictChannelIds: [],
          trustedRoleIds: [],
          protectedRoleIds: [],
        })),
      alertRateLimit: z
        .object({
          windowSeconds: z.number().int().min(1).catch(60),
          maxAlerts: z.number().int().min(1).catch(4),
        })
        .catch(() => ({ windowSeconds: 60, maxAlerts: 4 })),
      actionRateLimit: z
        .object({
          windowSeconds: z.number().int().min(1).catch(60),
          maxActions: z.number().int().min(1).catch(3),
        })
        .catch(() => ({ windowSeconds: 60, maxActions: 3 })),
    })
    .catch(() => ({
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
});
