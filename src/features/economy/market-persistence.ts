/**
 * Mongo transaction boundary for marketplace writes.
 *
 * The public market service owns command policy and cooldowns; this module owns
 * the multi-document invariant Mongo must commit atomically:
 * listing state, buyer/seller currency, escrowed inventory, and account upserts
 * change together or not at all.
 *
 * Gotcha: this intentionally bypasses `Ctx`/`World` caching. Market commands do
 * not read these same documents again inside the interaction after the write,
 * and correctness here depends on MongoDB session semantics that `World` does
 * not expose yet.
 */

import type { ClientSession, Collection, Db, Document, Filter } from "mongodb";
import { EconomyAccount, UserCurrency } from "@/components/economy/wallet";
import { User } from "@/components/entities";
import { UserInventory } from "@/components/rpg/inventory";
import { getDb, getMongoClient } from "@/core/db";
import { ErrResult, OkResult, type Result } from "@/core/result";
import { type MarketListingDoc, MarketListingSchema } from "@/db/schemas/market";
import { isAccountActive } from "@/features/economy/account";
import {
  calculatePurchase,
  cancelListingPatch,
  marketConflict,
  purchaseListingPatch,
  validateBuyableListing,
  validateCancellableListing,
} from "./market-transitions";
import {
  type BuyListingResult,
  type CancelListingResult,
  type CreateListingResult,
  type MarketConfig,
  MarketError,
} from "./market-types";

const TRANSACTION_REQUIRED =
  "Marketplace requires MongoDB transactions. Run MongoDB as a replica set or sharded cluster before using marketplace writes.";

type ComponentDoc = Document & { _id: string };

interface MarketCollections {
  readonly listings: Collection<MarketListingDoc>;
  readonly users: Collection<ComponentDoc>;
}

interface MarketTxContext extends MarketCollections {
  readonly session: ClientSession;
}

export class MarketPersistenceError extends Error {
  constructor(
    public readonly code: "TRANSACTION_UNSUPPORTED",
    message: string,
  ) {
    super(message);
    this.name = "MarketPersistenceError";
  }
}

type MarketPersistenceResult<T> = Result<T, MarketError | MarketPersistenceError>;

function collectionSet(db: Db): MarketCollections {
  return {
    listings: db.collection<MarketListingDoc>("marketListings"),
    users: db.collection<ComponentDoc>(User.collection),
  };
}

function normalizeFindOneAndUpdate<T>(result: T | { value?: T | null } | null): T | null {
  if (!result) return null;
  if (typeof result === "object" && "value" in result) return result.value ?? null;
  return result as T;
}

function transactionUnsupported(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /transaction numbers are only allowed|transactions are not supported|transaction not supported|replica set member|mongos/i.test(
    message,
  );
}

function unknownMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

async function runMarketTransaction<T>(
  fn: (tx: MarketTxContext) => Promise<T>,
): Promise<MarketPersistenceResult<T>> {
  const [client, db] = await Promise.all([getMongoClient(), getDb()]);
  const session = client.startSession();

  try {
    let value: T | undefined;
    await session.withTransaction(async () => {
      value = await fn({ ...collectionSet(db), session });
    });
    return OkResult(value as T);
  } catch (error) {
    if (transactionUnsupported(error)) {
      return ErrResult(new MarketPersistenceError("TRANSACTION_UNSUPPORTED", TRANSACTION_REQUIRED));
    }
    if (error instanceof MarketError) return ErrResult(error);
    return ErrResult(
      new MarketError("TRANSACTION_FAILED", unknownMessage(error, "Market transaction failed")),
    );
  } finally {
    await session.endSession();
  }
}

async function ensureActiveAccount(
  users: Collection<ComponentDoc>,
  userId: string,
  session: ClientSession,
): Promise<void> {
  const defaults = EconomyAccount.schema.parse({});
  const existing = await users.findOne({ _id: userId }, { session });
  if (!existing || !(EconomyAccount.name in existing)) {
    await users.updateOne(
      { _id: userId },
      { $set: { [EconomyAccount.name]: defaults }, $setOnInsert: { _id: userId } },
      { upsert: true, session },
    );
  }
  const doc = await users.findOne({ _id: userId }, { session });
  const account = EconomyAccount.schema.parse(doc?.[EconomyAccount.name] ?? {});
  if (!isAccountActive(account.status)) {
    throw new MarketError("ACCOUNT_INACTIVE", "Your economy account is not active");
  }
}

function stackPath(itemId: string): string {
  return `${UserInventory.name}.slots.${itemId}.qty`;
}

function balancePath(currencyId: string): string {
  return `${UserCurrency.name}.balances.${currencyId}`;
}

async function removeStackItems(
  users: Collection<ComponentDoc>,
  userId: string,
  itemId: string,
  quantity: number,
  session: ClientSession,
): Promise<void> {
  const updated = await users.findOneAndUpdate(
    { _id: userId, [stackPath(itemId)]: { $gte: quantity } },
    { $inc: { [stackPath(itemId)]: -quantity } },
    { returnDocument: "after", session },
  );

  if (!normalizeFindOneAndUpdate(updated)) {
    throw new MarketError(
      "INSUFFICIENT_INVENTORY",
      `You need ${quantity} ${itemId}, but do not have enough`,
    );
  }
}

async function addStackItems(
  users: Collection<ComponentDoc>,
  userId: string,
  itemId: string,
  quantity: number,
  session: ClientSession,
): Promise<void> {
  await users.findOneAndUpdate(
    { _id: userId },
    { $setOnInsert: { _id: userId }, $inc: { [stackPath(itemId)]: quantity } },
    { upsert: true, returnDocument: "after", session },
  );
}

async function debitBuyer(
  users: Collection<ComponentDoc>,
  buyerId: string,
  currencyId: string,
  total: number,
  session: ClientSession,
): Promise<number> {
  const result = await users.findOneAndUpdate(
    { _id: buyerId, [balancePath(currencyId)]: { $gte: total } },
    { $inc: { [balancePath(currencyId)]: -total } },
    { returnDocument: "after", session },
  );
  const doc = normalizeFindOneAndUpdate(result);
  if (!doc) {
    throw new MarketError("INSUFFICIENT_FUNDS", `You need ${total} ${currencyId}`);
  }
  const currency = UserCurrency.schema.parse(doc[UserCurrency.name] ?? {});
  return currency.balances[currencyId] ?? 0;
}

async function creditSeller(
  users: Collection<ComponentDoc>,
  sellerId: string,
  currencyId: string,
  sellerPayout: number,
  session: ClientSession,
): Promise<void> {
  await users.findOneAndUpdate(
    { _id: sellerId },
    { $setOnInsert: { _id: sellerId }, $inc: { [balancePath(currencyId)]: sellerPayout } },
    { upsert: true, returnDocument: "after", session },
  );
}

async function getParsedListing(
  listings: Collection<MarketListingDoc>,
  listingId: string,
  session: ClientSession,
): Promise<MarketListingDoc> {
  const raw = await listings.findOne({ _id: listingId } as Filter<MarketListingDoc>, { session });
  if (!raw) throw new MarketError("LISTING_NOT_FOUND", "Listing not found");
  return MarketListingSchema.parse(raw);
}

/**
 * Persist a new listing and seller escrow in one Mongo transaction.
 * Precondition: scalar input validation and listing ID generation have already
 * happened in `market.ts`.
 */
export async function createListingTx(input: {
  readonly listing: MarketListingDoc;
  readonly config: MarketConfig;
}): Promise<MarketPersistenceResult<CreateListingResult>> {
  return runMarketTransaction(async ({ listings, session, users }) => {
    await ensureActiveAccount(users, input.listing.sellerId, session);

    const activeCount = await listings.countDocuments(
      {
        guildId: input.listing.guildId,
        sellerId: input.listing.sellerId,
        status: "active",
      } as Filter<MarketListingDoc>,
      { session },
    );
    if (activeCount >= input.config.maxActiveListings) {
      throw new MarketError(
        "LISTING_LIMIT_REACHED",
        `You can have at most ${input.config.maxActiveListings} active listings`,
      );
    }

    await removeStackItems(
      users,
      input.listing.sellerId,
      input.listing.itemId,
      input.listing.quantity,
      session,
    );
    await listings.insertOne(input.listing, { session });

    return {
      listingId: input.listing._id,
      itemId: input.listing.itemId,
      quantity: input.listing.quantity,
      pricePerUnit: input.listing.pricePerUnit,
    };
  });
}

/**
 * Buy quantity from a listing with listing CAS, buyer debit, seller credit, and
 * buyer inventory grant in the same transaction.
 */
export async function buyListingTx(input: {
  readonly buyerId: string;
  readonly listingId: string;
  readonly quantity: number;
  readonly config: MarketConfig;
}): Promise<MarketPersistenceResult<BuyListingResult>> {
  return runMarketTransaction(async ({ listings, session, users }) => {
    await ensureActiveAccount(users, input.buyerId, session);

    const listing = await getParsedListing(listings, input.listingId, session);
    const listingError = validateBuyableListing(listing, input.buyerId, input.quantity);
    if (listingError) throw listingError;

    const { subtotal, fee, total, sellerPayout } = calculatePurchase(
      listing,
      input.quantity,
      input.config,
    );
    const buyerNewBalance = await debitBuyer(
      users,
      input.buyerId,
      input.config.currencyId,
      total,
      session,
    );

    const listingPatch = purchaseListingPatch(listing, input.quantity);
    const updated = await listings.findOneAndUpdate(
      {
        _id: input.listingId,
        version: listing.version,
        status: "active",
        quantity: { $gte: input.quantity },
      } as Filter<MarketListingDoc>,
      { $set: listingPatch },
      { returnDocument: "after", session },
    );
    if (!normalizeFindOneAndUpdate(updated)) throw marketConflict();

    await creditSeller(users, listing.sellerId, input.config.currencyId, sellerPayout, session);
    await addStackItems(users, input.buyerId, listing.itemId, input.quantity, session);

    return {
      listingId: input.listingId,
      itemId: listing.itemId,
      quantity: input.quantity,
      subtotal,
      fee,
      total,
      sellerPayout,
      buyerNewBalance,
      listingRemaining: listingPatch.quantity,
    };
  });
}

/**
 * Cancel a listing and return escrowed inventory in one Mongo transaction.
 * Moderator override only affects the ownership check; status/version still
 * guard the write.
 */
export async function cancelListingTx(input: {
  readonly actorId: string;
  readonly listingId: string;
  readonly allowModeratorOverride?: boolean;
}): Promise<MarketPersistenceResult<CancelListingResult>> {
  return runMarketTransaction(async ({ listings, session, users }) => {
    const listing = await getParsedListing(listings, input.listingId, session);
    const listingError = validateCancellableListing(
      listing,
      input.actorId,
      input.allowModeratorOverride,
    );
    if (listingError) throw listingError;

    const updated = await listings.findOneAndUpdate(
      {
        _id: input.listingId,
        version: listing.version,
        status: "active",
      } as Filter<MarketListingDoc>,
      { $set: cancelListingPatch(listing) },
      { returnDocument: "after", session },
    );
    if (!normalizeFindOneAndUpdate(updated)) throw marketConflict();

    await addStackItems(users, listing.sellerId, listing.itemId, listing.quantity, session);

    return {
      listingId: input.listingId,
      itemId: listing.itemId,
      returnedQuantity: listing.quantity,
    };
  });
}

/** Return active listings for market browse without opening a transaction. */
export async function findActiveMarketListings(
  guildId: string,
  options: { itemId?: string; sellerId?: string; limit?: number; skip?: number } = {},
): Promise<Result<MarketListingDoc[]>> {
  try {
    const listings = collectionSet(await getDb()).listings;
    const filter: Filter<MarketListingDoc> = { guildId, status: "active" };
    if (options.itemId) filter.itemId = options.itemId;
    if (options.sellerId) filter.sellerId = options.sellerId;

    let cursor = listings.find(filter).sort({ pricePerUnit: 1, createdAt: 1 });
    if (options.skip) cursor = cursor.skip(options.skip);
    if (options.limit) cursor = cursor.limit(options.limit);
    const docs = await cursor.toArray();
    return OkResult(docs.map((doc) => MarketListingSchema.parse(doc)));
  } catch (error) {
    return ErrResult(error instanceof Error ? error : new Error(String(error)));
  }
}
