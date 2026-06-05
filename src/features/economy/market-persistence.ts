/**
 * Entity-backed transaction boundary for marketplace writes.
 *
 * The public market service owns command policy and cooldowns; this module owns
 * the multi-entity invariant Mongo must commit atomically: listing state,
 * buyer/seller currency, and inventory escrow change together or not at all.
 */

import {
  type MarketListingDoc,
  MarketListingRecord,
  type MarketListingValue,
  withMarketListingId,
} from "@/components/economy/market-listing";
import { EconomyAccount, UserCurrency } from "@/components/economy/wallet";
import { MarketListing as MarketListingKind, User } from "@/components/entities";
import { UserInventory, type UserInventoryValue } from "@/components/rpg/inventory";
import { ErrResult, OkResult, type Result } from "@/core/result";
import { isAccountActive } from "@/features/economy/account";
import type { Ctx, Transaction } from "@/framework/types";
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
  ctx: Ctx,
  fn: (tx: Transaction) => Promise<T>,
): Promise<MarketPersistenceResult<T>> {
  try {
    return OkResult(await ctx.transaction(fn));
  } catch (error) {
    if (transactionUnsupported(error)) {
      return ErrResult(new MarketPersistenceError("TRANSACTION_UNSUPPORTED", TRANSACTION_REQUIRED));
    }
    if (error instanceof MarketError) return ErrResult(error);
    return ErrResult(
      new MarketError("TRANSACTION_FAILED", unknownMessage(error, "Market transaction failed")),
    );
  }
}

function listingValue(doc: MarketListingDoc): MarketListingValue {
  return {
    guildId: doc.guildId,
    sellerId: doc.sellerId,
    itemId: doc.itemId,
    itemKind: doc.itemKind,
    pricePerUnit: doc.pricePerUnit,
    quantity: doc.quantity,
    status: doc.status,
    version: doc.version,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    expiresAt: doc.expiresAt,
  };
}

function stackQty(slot: UserInventoryValue["slots"][string] | undefined): number {
  return slot && "qty" in slot ? slot.qty : 0;
}

async function ensureActiveAccount(tx: Transaction, userId: string): Promise<void> {
  const user = tx.of(User, userId);
  if (!(await user.has(EconomyAccount))) {
    await user.set(EconomyAccount, EconomyAccount.schema.parse({}));
  }
  const account = await user.get(EconomyAccount);
  if (!isAccountActive(account.status)) {
    throw new MarketError("ACCOUNT_INACTIVE", "Your economy account is not active");
  }
}

async function removeStackItems(
  tx: Transaction,
  userId: string,
  itemId: string,
  quantity: number,
): Promise<void> {
  const user = tx.of(User, userId);
  const inventory = await user.get(UserInventory);
  const current = stackQty(inventory.slots[itemId]);
  if (current < quantity) {
    throw new MarketError(
      "INSUFFICIENT_INVENTORY",
      `You need ${quantity} ${itemId}, but do not have enough`,
    );
  }
  await user.update(UserInventory, {
    slots: {
      ...inventory.slots,
      [itemId]: { qty: current - quantity },
    },
  });
}

async function addStackItems(
  tx: Transaction,
  userId: string,
  itemId: string,
  quantity: number,
): Promise<void> {
  const user = tx.of(User, userId);
  const inventory = await user.get(UserInventory);
  const current = stackQty(inventory.slots[itemId]);
  await user.update(UserInventory, {
    slots: {
      ...inventory.slots,
      [itemId]: { qty: current + quantity },
    },
  });
}

async function debitBuyer(
  tx: Transaction,
  buyerId: string,
  currencyId: string,
  total: number,
): Promise<number> {
  const user = tx.of(User, buyerId);
  const currency = await user.get(UserCurrency);
  const current = currency.balances[currencyId] ?? 0;
  if (current < total) {
    throw new MarketError("INSUFFICIENT_FUNDS", `You need ${total} ${currencyId}`);
  }
  const next = current - total;
  await user.update(UserCurrency, {
    balances: {
      ...currency.balances,
      [currencyId]: next,
    },
  });
  return next;
}

async function creditSeller(
  tx: Transaction,
  sellerId: string,
  currencyId: string,
  sellerPayout: number,
): Promise<void> {
  const user = tx.of(User, sellerId);
  const currency = await user.get(UserCurrency);
  await user.update(UserCurrency, {
    balances: {
      ...currency.balances,
      [currencyId]: (currency.balances[currencyId] ?? 0) + sellerPayout,
    },
  });
}

async function getListing(tx: Transaction, listingId: string): Promise<MarketListingDoc> {
  const value = await tx.of(MarketListingKind, listingId).peek(MarketListingRecord);
  if (!value) throw new MarketError("LISTING_NOT_FOUND", "Listing not found");
  return withMarketListingId(listingId, value);
}

/**
 * Persist a new listing and seller escrow in one Mongo transaction.
 * Precondition: scalar input validation and listing ID generation have already
 * happened in `market.ts`.
 */
export async function createListingTx(
  ctx: Ctx,
  input: {
    readonly listing: MarketListingDoc;
    readonly config: MarketConfig;
  },
): Promise<MarketPersistenceResult<CreateListingResult>> {
  return runMarketTransaction(ctx, async (tx) => {
    await ensureActiveAccount(tx, input.listing.sellerId);

    const activeRows = await tx
      .select(MarketListingRecord)
      .whereEq((listing) => listing.guildId, input.listing.guildId)
      .whereEq((listing) => listing.sellerId, input.listing.sellerId)
      .whereEq((listing) => listing.status, "active")
      .limit(input.config.maxActiveListings)
      .run();
    if (activeRows.length >= input.config.maxActiveListings) {
      throw new MarketError(
        "LISTING_LIMIT_REACHED",
        `You can have at most ${input.config.maxActiveListings} active listings`,
      );
    }

    await removeStackItems(
      tx,
      input.listing.sellerId,
      input.listing.itemId,
      input.listing.quantity,
    );
    await tx
      .of(MarketListingKind, input.listing._id)
      .set(MarketListingRecord, listingValue(input.listing));

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
export async function buyListingTx(
  ctx: Ctx,
  input: {
    readonly buyerId: string;
    readonly listingId: string;
    readonly quantity: number;
    readonly config: MarketConfig;
  },
): Promise<MarketPersistenceResult<BuyListingResult>> {
  return runMarketTransaction(ctx, async (tx) => {
    await ensureActiveAccount(tx, input.buyerId);

    const listing = await getListing(tx, input.listingId);
    const listingError = validateBuyableListing(listing, input.buyerId, input.quantity);
    if (listingError) throw listingError;

    const { subtotal, fee, total, sellerPayout } = calculatePurchase(
      listing,
      input.quantity,
      input.config,
    );
    const buyerNewBalance = await debitBuyer(tx, input.buyerId, input.config.currencyId, total);

    const listingPatch = purchaseListingPatch(listing, input.quantity);
    const current = await getListing(tx, input.listingId);
    if (
      current.version !== listing.version ||
      current.status !== "active" ||
      current.quantity < input.quantity
    ) {
      throw marketConflict();
    }
    await tx.of(MarketListingKind, input.listingId).update(MarketListingRecord, listingPatch);

    await creditSeller(tx, listing.sellerId, input.config.currencyId, sellerPayout);
    await addStackItems(tx, input.buyerId, listing.itemId, input.quantity);

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
export async function cancelListingTx(
  ctx: Ctx,
  input: {
    readonly actorId: string;
    readonly listingId: string;
    readonly allowModeratorOverride?: boolean;
  },
): Promise<MarketPersistenceResult<CancelListingResult>> {
  return runMarketTransaction(ctx, async (tx) => {
    const listing = await getListing(tx, input.listingId);
    const listingError = validateCancellableListing(
      listing,
      input.actorId,
      input.allowModeratorOverride,
    );
    if (listingError) throw listingError;

    const current = await getListing(tx, input.listingId);
    if (current.version !== listing.version || current.status !== "active") {
      throw marketConflict();
    }
    await tx
      .of(MarketListingKind, input.listingId)
      .update(MarketListingRecord, cancelListingPatch(listing));

    await addStackItems(tx, listing.sellerId, listing.itemId, listing.quantity);

    return {
      listingId: input.listingId,
      itemId: listing.itemId,
      returnedQuantity: listing.quantity,
    };
  });
}

/** Return active listings for market browse without opening a transaction. */
export async function findActiveMarketListings(
  ctx: Ctx,
  guildId: string,
  options: { itemId?: string; sellerId?: string; limit?: number; skip?: number } = {},
): Promise<Result<MarketListingDoc[]>> {
  try {
    let query = ctx
      .select(MarketListingRecord)
      .whereEq((listing) => listing.guildId, guildId)
      .whereEq((listing) => listing.status, "active");
    if (options.itemId) query = query.whereEq((listing) => listing.itemId, options.itemId);
    if (options.sellerId) query = query.whereEq((listing) => listing.sellerId, options.sellerId);
    query = query
      .sortAsc((listing) => listing.pricePerUnit)
      .thenAsc((listing) => listing.createdAt);
    if (options.skip) query = query.skip(options.skip);
    if (options.limit) query = query.limit(options.limit);
    const rows = await query.run();
    return OkResult(rows.map((row) => withMarketListingId(row.id, row.value)));
  } catch (error) {
    return ErrResult(error instanceof Error ? error : new Error(String(error)));
  }
}
