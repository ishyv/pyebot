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

// ---------------------------------------------------------------------------
// Strict input validation (dashboard + bridge boundary)
//
// `EmbedConfigSchema` above uses `.catch()` everywhere: it is read-lenient and
// silently coerces bad values to defaults, which is correct for trusting stored
// documents but useless for telling a user *why* their input was rejected. The
// schema below is the opposite — it reports field-level errors — and is shared
// by the web client, the web server action, and the bridge so the three never
// drift. Imported into the webapp via the `$shared/embed-config` alias.
// ---------------------------------------------------------------------------

/** Discord's documented embed limits. Single source of truth for client + server validation. */
export const EMBED_LIMITS = {
  title: 256,
  description: 4096,
  authorName: 256,
  footerText: 2048,
  fieldName: 256,
  fieldValue: 1024,
  fieldCount: 25,
  /** Combined cap across title + description + author name + footer + every field name/value. */
  total: 6000,
} as const;

/** Strict per-field schema: a field must have a non-empty name and value. */
export const EmbedFieldInputSchema = z.object({
  name: z.string().trim().min(1, "field name is required").max(EMBED_LIMITS.fieldName),
  value: z.string().trim().min(1, "field value is required").max(EMBED_LIMITS.fieldValue),
  inline: z.boolean(),
});

/** The editable, user-supplied subset of an embed (mirrors `EmbedConfigDraft`). */
export interface EmbedDraftInput {
  embedTitle: string | null;
  embedDescription: string | null;
  embedAuthorName: string | null;
  embedFooterText: string | null;
  embedFields: { name: string; value: string }[];
}

/**
 * Sum of every character-counted part of an embed, for Discord's combined 6000-char limit.
 *
 * Discord counts the title, description, author name, footer text, and the name
 * AND value of every field toward one total. It does NOT count URLs, the color,
 * image/thumbnail links, or the timestamp. Return the total character count.
 *
 */
export function embedTotalLength(draft: EmbedDraftInput): number {
  let total = 0;
  total += draft.embedTitle?.length ?? 0;
  total += draft.embedDescription?.length ?? 0;
  total += draft.embedAuthorName?.length ?? 0;
  total += draft.embedFooterText?.length ?? 0;
  for (const field of draft.embedFields) {
    total += field.name.length + field.value.length;
  }
  return total;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v.length > 0 ? v : null))
    .nullable();

const optionalUrl = z
  .string()
  .trim()
  .url("must be a valid url")
  .or(z.literal("").transform(() => null))
  .nullable();

/**
 * Strict validator for user-supplied embed input. Unlike `EmbedConfigSchema`,
 * this reports errors instead of coercing. Enforces per-field Discord limits and
 * the combined 6000-char total. Does NOT require the embed to be non-empty —
 * saving an empty draft is allowed; sendability is checked separately at send time.
 */
export const EmbedDraftInputSchema = z
  .object({
    embedTitle: optionalText(EMBED_LIMITS.title),
    embedDescription: optionalText(EMBED_LIMITS.description),
    embedColor: z.number().int().min(0).max(0xffffff).nullable(),
    embedUrl: optionalUrl,
    embedThumbnail: optionalUrl,
    embedImage: optionalUrl,
    embedAuthorName: optionalText(EMBED_LIMITS.authorName),
    embedAuthorIconUrl: optionalUrl,
    embedAuthorUrl: optionalUrl,
    embedFooterText: optionalText(EMBED_LIMITS.footerText),
    embedFooterIconUrl: optionalUrl,
    embedFields: z.array(EmbedFieldInputSchema).max(EMBED_LIMITS.fieldCount),
  })
  .superRefine((draft, ctx) => {
    const total = embedTotalLength({
      embedTitle: draft.embedTitle,
      embedDescription: draft.embedDescription,
      embedAuthorName: draft.embedAuthorName,
      embedFooterText: draft.embedFooterText,
      embedFields: draft.embedFields,
    });
    if (total > EMBED_LIMITS.total) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `embed exceeds ${EMBED_LIMITS.total} total characters (${total})`,
      });
    }
  });

export type EmbedDraftInputValues = z.infer<typeof EmbedDraftInputSchema>;
