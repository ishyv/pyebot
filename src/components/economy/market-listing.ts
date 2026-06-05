/**
 * MarketListingRecord — a single market entry: someone is selling N of item X
 * for Y coins each, in a specific guild.
 *
 * Cross-entity queries hit this collection a lot (browse market, find by
 * seller, find by item) — that's why it's its own entity kind rather than a
 * sub-doc on the seller.
 */

import { z } from "zod";
import { MarketListing } from "@/components/entities";
import { defineComponent } from "@/framework";

export const MarketListingStatus = z.enum(["active", "sold_out", "cancelled", "expired"]);
export type MarketListingStatusValue = z.infer<typeof MarketListingStatus>;

export const MarketItemKind = z.enum(["stackable", "instance"]);
export type MarketItemKindValue = z.infer<typeof MarketItemKind>;

export const MarketListingRecord = defineComponent(
  MarketListing,
  "listing",
  z.object({
    guildId: z.string(),
    sellerId: z.string(),
    itemId: z.string(),
    itemKind: MarketItemKind.default("stackable"),
    pricePerUnit: z.number().int().min(1),
    quantity: z.number().int().min(0),
    status: MarketListingStatus.default("active"),
    version: z.number().int().nonnegative().default(0),
    createdAt: z.coerce.date().default(() => new Date()),
    updatedAt: z.coerce.date().default(() => new Date()),
    expiresAt: z.coerce.date().nullable().optional(),
  }),
);

export type MarketListingValue = z.infer<typeof MarketListingRecord.schema>;
export type MarketListingDoc = MarketListingValue & { readonly _id: string };

/** Reattaches the entity id for market code that returns listing-shaped DTOs. */
export function withMarketListingId(id: string, value: MarketListingValue): MarketListingDoc {
  return { _id: id, ...value };
}
