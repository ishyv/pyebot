/**
 * BannedImage — one moderator-managed image fingerprint for AutoMod.
 *
 * The original image is not stored. Discord CDN metadata is kept only so
 * moderators can understand what they added; matching depends on hashes.
 */

import { z } from "zod";
import { component } from "@/framework/component";

export const BannedImageHashSchema = z.object({
  average: z.string(),
  difference: z.string(),
  verticalDifference: z.string(),
});

export type BannedImageHashValue = z.infer<typeof BannedImageHashSchema>;

export const BannedImage = component({
  collection: "banned_images",
  schema: z.object({
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
  }),
});

export type BannedImageValue = z.infer<typeof BannedImage.schema>;

/** Stable document id for a guild-scoped banned image record. */
export function bannedImageId(guildId: string, id: string): string {
  return `${guildId}:${id}`;
}
