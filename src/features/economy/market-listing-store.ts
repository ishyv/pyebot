import type { Result } from "@/core/result";
import { countActiveListings, findActiveListings, marketStore } from "@/db/repositories/economy";
import type { MarketListingDoc } from "@/db/schemas/market";
import { listingSnapshotPatch } from "./market-transitions";

/**
 * Small adapter around the legacy market repository.
 * The market service talks to this module so legacy `MongoStore` details do not spread.
 *
 * This is deliberately not a new repository abstraction. It is a quarantine
 * layer for the remaining `MongoStore` market collection while commands keep
 * importing the stable market service API.
 */
export const marketListingStore = {
  get(id: string): Promise<Result<MarketListingDoc | null>> {
    return marketStore.get(id);
  },

  save(listing: MarketListingDoc): Promise<Result<MarketListingDoc>> {
    return marketStore.set(listing._id, listing);
  },

  replaceIfVersion(
    listingId: string,
    expectedVersion: number,
    next: Partial<MarketListingDoc>,
  ): Promise<Result<MarketListingDoc | null>> {
    return marketStore.replaceIfMatch(listingId, { version: expectedVersion }, next);
  },

  restoreSnapshot(
    listing: MarketListingDoc,
    expectedVersion: number,
  ): Promise<Result<MarketListingDoc | null>> {
    // WHY: rollback is also CAS-guarded. If another write touched the listing
    // after the failed transaction, silently overwriting it would make the
    // recovery path more dangerous than the original failure.
    return marketStore.replaceIfMatch(
      listing._id,
      { version: expectedVersion },
      listingSnapshotPatch(listing),
    );
  },

  countActive(guildId: string, sellerId: string): Promise<Result<number>> {
    return countActiveListings(guildId, sellerId);
  },

  findActive(
    guildId: string,
    options: { itemId?: string; sellerId?: string; limit?: number; skip?: number } = {},
  ): Promise<Result<MarketListingDoc[]>> {
    return findActiveListings(guildId, options);
  },
};
