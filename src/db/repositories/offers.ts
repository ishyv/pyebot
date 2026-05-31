import type { Filter } from "mongodb";
import type { Result } from "@/core/result";
import { ErrResult, OkResult } from "@/core/result";
import { type Offer, OfferSchema, type OfferStatus } from "@/db/schemas/offer";
import { MongoStore } from "@/db/store";

const offerStore = new MongoStore("offers", OfferSchema);

/** Save an offer document through the legacy Result-returning store. */
export function saveOffer(offer: Offer): Promise<Result<Offer>> {
  return offerStore.set(offer._id, offer);
}

/** Read one offer by ID. */
export function getOffer(offerId: string): Promise<Result<Offer | null>> {
  return offerStore.get(offerId);
}

/** Return the active offer for one author in one guild, if any. */
export async function findActiveOfferByAuthor(
  guildId: string,
  authorId: string,
  activeStatuses: readonly OfferStatus[],
): Promise<Result<Offer | null>> {
  try {
    const col = await offerStore.collection();
    const filter: Filter<Offer> = {
      guildId,
      authorId,
      status: { $in: [...activeStatuses] },
    } as Filter<Offer>;
    const doc = await col.findOne(filter);
    return OkResult(doc ? OfferSchema.parse(doc) : null);
  } catch (err) {
    return ErrResult(err instanceof Error ? err : new Error(String(err)));
  }
}
