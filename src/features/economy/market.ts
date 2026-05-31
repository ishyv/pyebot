/**
 * Economy marketplace: create, buy, cancel, browse listings.
 *
 * This module is the orchestration boundary for command-facing market actions.
 * Pure listing validation lives in `market-transitions`; multi-document writes
 * are delegated to `market-persistence`, which is the only market path allowed
 * to open MongoDB transactions directly.
 *
 * Invariants:
 * - Seller inventory escrow and listing creation commit in one transaction.
 * - Purchases mutate listing, buyer/seller currency, and buyer inventory together.
 * - Process-local listing locks reduce duplicate interaction spam only; MongoDB
 *   transactions and listing status/version filters own correctness.
 *
 * It does not change command UX or support instance-item listings yet.
 */

import { ErrResult, OkResult, type Result } from "@/core/result";
import type { MarketListingDoc } from "@/db/schemas/market";
import type { Ctx } from "@/framework/types";
import { buildListingId } from "@/utils/ids";
import {
  buyListingTx,
  cancelListingTx,
  createListingTx,
  findActiveMarketListings,
  MarketPersistenceError,
} from "./market-persistence";
import {
  resolveMarketConfig,
  validateCreateListingInput,
  validatePurchaseQuantity,
} from "./market-transitions";
import {
  type BrowseListingsResult,
  type BuyListingResult,
  type CancelListingResult,
  type CreateListingResult,
  type MarketConfig,
  MarketError,
  STACKABLE_ITEM_KIND,
} from "./market-types";

export type {
  BrowseListingsResult,
  BuyListingResult,
  CancelListingResult,
  CreateListingResult,
  MarketConfig,
} from "./market-types";
export { DEFAULT_MARKET_CONFIG, MarketError, STACKABLE_ITEM_KIND } from "./market-types";

async function withListingLock<T>(
  ctx: Ctx,
  listingId: string,
  fn: () => Promise<Result<T, MarketError>>,
): Promise<Result<T, MarketError>> {
  const key = `market:listing:${listingId}`;
  if (!ctx.locks.tryAcquire(key)) {
    return ErrResult(new MarketError("TRANSACTION_FAILED", "Listing is busy. Try again."));
  }
  try {
    return await fn();
  } finally {
    // WHY: the lock is a local UX/contention reducer so two button clicks in
    // this process do not both enter the transaction path. Correctness still
    // comes from MongoDB transaction isolation and listing version/status filters.
    ctx.locks.release(key);
  }
}

function mapPersistenceError(error: MarketError | MarketPersistenceError): MarketError {
  if (error instanceof MarketPersistenceError) {
    return new MarketError("TRANSACTION_FAILED", error.message);
  }
  return error;
}

// ---------------------------------------------------------------------------
// createListing
// ---------------------------------------------------------------------------

/**
 * Creates a stackable-item listing after reserving seller inventory.
 * Side effects: opens a MongoDB transaction that upserts the seller account,
 * escrows inventory, and inserts the listing; cooldown is set only after commit.
 */
export async function createListing(
  ctx: Ctx,
  sellerId: string,
  guildId: string,
  itemId: string,
  quantity: number,
  pricePerUnit: number,
  config?: Partial<MarketConfig>,
): Promise<Result<CreateListingResult, MarketError>> {
  const cfg = resolveMarketConfig(config);
  const inputError = validateCreateListingInput(itemId, quantity, pricePerUnit, cfg);
  if (inputError) return ErrResult(inputError);

  if (ctx.cooldowns.isOnCooldown(sellerId, "market:create")) {
    const remaining = ctx.cooldowns.getRemainingMs(sellerId, "market:create");
    return ErrResult(
      new MarketError("COOLDOWN_ACTIVE", `Wait ${remaining}ms before listing again`),
    );
  }

  const now = new Date();
  const listing: MarketListingDoc = {
    _id: buildListingId(),
    guildId,
    sellerId,
    itemId,
    itemKind: STACKABLE_ITEM_KIND,
    pricePerUnit,
    quantity,
    status: "active",
    version: 0,
    createdAt: now,
    updatedAt: now,
    expiresAt: null,
  };

  const result = await createListingTx({ listing, config: cfg });
  if (result.isErr()) return ErrResult(mapPersistenceError(result.error));

  ctx.cooldowns.set(sellerId, "market:create", cfg.createCooldownMs);

  return OkResult(result.unwrap());
}

// ---------------------------------------------------------------------------
// buyListing
// ---------------------------------------------------------------------------

/**
 * Buys quantity from an active listing with per-listing locking and CAS.
 * Side effects: the transaction path debits buyer, updates listing quantity/status,
 * credits seller, and grants buyer inventory atomically.
 */
export async function buyListing(
  ctx: Ctx,
  buyerId: string,
  listingId: string,
  quantity: number,
  config?: Partial<MarketConfig>,
): Promise<Result<BuyListingResult, MarketError>> {
  const cfg = resolveMarketConfig(config);
  const inputError = validatePurchaseQuantity(quantity);
  if (inputError) return ErrResult(inputError);

  if (ctx.cooldowns.isOnCooldown(buyerId, "market:buy")) {
    const remaining = ctx.cooldowns.getRemainingMs(buyerId, "market:buy");
    return ErrResult(new MarketError("COOLDOWN_ACTIVE", `Wait ${remaining}ms before buying again`));
  }

  return withListingLock(ctx, listingId, async () => {
    const result = await buyListingTx({ buyerId, listingId, quantity, config: cfg });
    if (result.isErr()) return ErrResult(mapPersistenceError(result.error));

    ctx.cooldowns.set(buyerId, "market:buy", cfg.buyCooldownMs);

    return OkResult(result.unwrap());
  });
}

// ---------------------------------------------------------------------------
// cancelListing
// ---------------------------------------------------------------------------

/**
 * Cancels an active listing and returns escrowed inventory to the seller.
 * Moderator override only bypasses ownership; listing status and CAS still apply.
 */
export async function cancelListing(
  ctx: Ctx,
  actorId: string,
  listingId: string,
  options: { allowModeratorOverride?: boolean } = {},
): Promise<Result<CancelListingResult, MarketError>> {
  return withListingLock(ctx, listingId, async () => {
    const result = await cancelListingTx({
      actorId,
      listingId,
      allowModeratorOverride: options.allowModeratorOverride,
    });
    if (result.isErr()) return ErrResult(mapPersistenceError(result.error));
    return OkResult(result.unwrap());
  });
}

// ---------------------------------------------------------------------------
// browseListings
// ---------------------------------------------------------------------------

/**
 * Returns active listings for a guild through the listing-store adapter.
 * This is read-only; `ctx` is accepted to preserve the public market service signature.
 */
export async function browseListings(
  ctx: Ctx,
  guildId: string,
  options: { itemId?: string; sellerId?: string; page?: number; pageSize?: number } = {},
  config?: Partial<MarketConfig>,
): Promise<Result<BrowseListingsResult, MarketError>> {
  void ctx;
  const cfg = resolveMarketConfig(config);
  const page = Math.max(0, options.page ?? 0);
  const pageSize = options.pageSize ?? cfg.pageSize;
  const skip = page * pageSize;

  const res = await findActiveMarketListings(guildId, {
    itemId: options.itemId,
    sellerId: options.sellerId,
    skip,
    limit: pageSize,
  });

  if (res.isErr()) return ErrResult(new MarketError("TRANSACTION_FAILED", res.error.message));

  return OkResult({ listings: res.unwrap(), page, pageSize });
}
