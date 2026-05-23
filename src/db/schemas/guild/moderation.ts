import { z } from "zod";

export const EscalationThresholdSchema = z.object({
  warnCount: z.number().int(),
  action: z.enum(["timeout", "kick", "ban"]),
  durationKey: z.string().optional(), // e.g. "1h", "1d" — used when action is "timeout"
});
export type EscalationThreshold = z.infer<typeof EscalationThresholdSchema>;

export const ModerationConfigSchema = z
  .object({
    modLogChannelId: z.string().nullable().catch(null),
    appealsChannelId: z.string().nullable().catch(null),
    appealsQueueMessageId: z.string().nullable().catch(null),
    altDetectionEnabled: z.boolean().catch(false),
    escalation: z
      .object({
        enabled: z.boolean().catch(false),
        thresholds: z.array(EscalationThresholdSchema).catch(() => []),
      })
      .catch(() => ({ enabled: false, thresholds: [] })),
    tempBanCheckIntervalMs: z.number().int().catch(60_000),
    quarantine: z
      .object({
        enabled: z.boolean().catch(false),
        roleId: z.string().nullable().catch(null),
        channelId: z.string().nullable().catch(null),
      })
      .catch(() => ({ enabled: false, roleId: null, channelId: null })),
    verification: z
      .object({
        enabled: z.boolean().catch(false),
        mode: z.enum(["button", "account_age"]).catch("button"),
        minAccountAgeDays: z.number().int().catch(0),
        channelId: z.string().nullable().catch(null),
        roleId: z.string().nullable().catch(null),
        kickOnFail: z.boolean().catch(false),
      })
      .catch(() => ({
        enabled: false,
        mode: "button" as const,
        minAccountAgeDays: 0,
        channelId: null,
        roleId: null,
        kickOnFail: false,
      })),
    restrictionRoles: z
      .object({
        forums: z.string().nullable().catch(null),
        voice: z.string().nullable().catch(null),
        jobs: z.string().nullable().catch(null),
        all: z.string().nullable().catch(null),
      })
      .catch(() => ({ forums: null, voice: null, jobs: null, all: null })),
  })
  .catch(() => ({
    modLogChannelId: null,
    appealsChannelId: null,
    appealsQueueMessageId: null,
    altDetectionEnabled: false,
    escalation: { enabled: false, thresholds: [] },
    tempBanCheckIntervalMs: 60_000,
    quarantine: { enabled: false, roleId: null, channelId: null },
    verification: {
      enabled: false,
      mode: "button" as const,
      minAccountAgeDays: 0,
      channelId: null,
      roleId: null,
      kickOnFail: false,
    },
    restrictionRoles: { forums: null, voice: null, jobs: null, all: null },
  }));
