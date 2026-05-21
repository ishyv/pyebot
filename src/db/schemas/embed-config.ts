/**
 * Embed config schema.
 *
 * Stores per-guild embed templates created through the embed-creator feature.
 * Each document is keyed `{guildId}:{name}` (see `embedConfigId` in the
 * embeds repository). Configs can optionally be pinned as sticky messages,
 * sent on a recurring schedule, or used as one-off embed templates.
 *
 * Validated at the repository boundary; plain `EmbedConfig` type used inside.
 */
import { z } from "zod";

export const SCHEDULE_INTERVAL_HOURS = [1, 6, 12, 24, 168] as const;
export type ScheduleIntervalHours = (typeof SCHEDULE_INTERVAL_HOURS)[number];

export const EmbedFieldSchema = z.object({
  name: z.string().max(256),
  value: z.string().max(1024),
  inline: z.boolean().catch(false),
});

export const EmbedConfigSchema = z.object({
  _id: z.string(),
  guildId: z.string(),
  name: z.string().max(64),
  createdBy: z.string(),
  embedTitle: z.string().max(256).nullable().catch(null),
  embedDescription: z.string().max(4096).nullable().catch(null),
  embedColor: z.number().int().nullable().catch(null),
  embedUrl: z.string().nullable().catch(null),
  embedThumbnail: z.string().nullable().catch(null),
  embedImage: z.string().nullable().catch(null),
  embedAuthorName: z.string().max(256).nullable().catch(null),
  embedAuthorIconUrl: z.string().nullable().catch(null),
  embedAuthorUrl: z.string().nullable().catch(null),
  embedFooterText: z.string().max(2048).nullable().catch(null),
  embedFooterIconUrl: z.string().nullable().catch(null),
  embedFields: z.array(EmbedFieldSchema).catch(() => []),
  script: z.string().max(4000).nullable().catch(null),
  scriptEnabled: z.boolean().catch(false),
  channelId: z.string().nullable().catch(null),
  scheduleEnabled: z.boolean().catch(false),
  scheduleIntervalHours: z
    .union([z.literal(1), z.literal(6), z.literal(12), z.literal(24), z.literal(168)])
    .nullable()
    .catch(null),
  scheduledNextSendAt: z.coerce.date().nullable().catch(null),
  scheduledLastSentAt: z.coerce.date().nullable().catch(null),
  stickyEnabled: z.boolean().catch(false),
  stickyMessageId: z.string().nullable().catch(null),
  stickyLastResendAt: z.coerce.date().nullable().catch(null),
  createdAt: z.coerce.date().catch(() => new Date()),
  updatedAt: z.coerce.date().catch(() => new Date()),
});

export type EmbedConfig = z.infer<typeof EmbedConfigSchema>;
export type EmbedField = z.infer<typeof EmbedFieldSchema>;
