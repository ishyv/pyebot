/**
 * Banned images — moderator-managed image fingerprints for AutoMod, stored as a
 * per-guild map on the `Guild` entity (keyed by the record's short id; the old
 * `{guildId}:{id}` document id becomes the map key).
 *
 * The original image is not stored. Discord CDN metadata is kept only so
 * moderators can understand what they added; matching depends on hashes.
 * `removed` records are kept (soft delete) for audit; only `active` ones match.
 */

import { z } from "zod";
import { Guild } from "@/components/entities";
import { defineComponent } from "@/framework";

export const BannedImageHashSchema = z.object({
  average: z.string(),
  difference: z.string(),
  verticalDifference: z.string(),
});

export type BannedImageHashValue = z.infer<typeof BannedImageHashSchema>;

export const BannedImageSchema = z.object({
  guildId: z.string(),
  status: z.enum(["active", "removed"]).default("active"),
  reason: z.string(),
  label: z.string().nullable().default(null),
  sourceUrl: z.string().nullable().default(null),
  sourceContentType: z.string().nullable().default(null),
  sourceFilename: z.string().nullable().default(null),
  hashes: BannedImageHashSchema,
  addedBy: z.string(),
  addedAt: z.coerce.date().default(() => new Date()),
  removedBy: z.string().nullable().default(null),
  removedAt: z.coerce.date().nullable().default(null),
});

export type BannedImageValue = z.infer<typeof BannedImageSchema>;

export const BannedImages = defineComponent(
  Guild,
  "bannedImages",
  z.object({
    /** short image id → record. */
    records: z.record(z.string(), BannedImageSchema).default(() => ({})),
  }),
);

export type BannedImagesValue = z.infer<typeof BannedImages.schema>;
