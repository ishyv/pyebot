import { z } from "zod";

export const MarketListingStatusSchema = z.enum(["active", "sold_out", "cancelled", "expired"]);
export type MarketListingStatus = z.infer<typeof MarketListingStatusSchema>;

export const MarketItemKindSchema = z.enum(["stackable", "instance"]);
export type MarketItemKind = z.infer<typeof MarketItemKindSchema>;

export const MarketListingSchema = z.object({
  _id: z.string(),
  guildId: z.string(),
  sellerId: z.string(),
  itemId: z.string(),
  itemKind: MarketItemKindSchema.catch("stackable"),
  pricePerUnit: z.number().int().min(1),
  quantity: z.number().int().min(0),
  status: MarketListingStatusSchema.catch("active"),
  version: z.number().int().nonnegative().catch(0),
  createdAt: z.coerce.date().catch(() => new Date()),
  updatedAt: z.coerce.date().catch(() => new Date()),
  expiresAt: z.coerce.date().nullable().optional(),
});

export type MarketListingDoc = z.infer<typeof MarketListingSchema>;
