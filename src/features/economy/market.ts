/**
 * Economy marketplace: create, buy, cancel, browse listings.
 *
 * Architecture: Plain exported async functions — no classes (except MarketError).
 * Dependencies: ctx for cooldowns + mutations, ensureAccount/isAccountActive from account,
 *   marketStore/query helpers from economy repo.
 *
 * NOTE: Inventory escrow (deducting items on list, returning on cancel, granting on buy)
 * is stubbed pending the features/inventory module implementation.
 */

import { OkResult, ErrResult, type Result } from "@/core/result";
import type { Ctx } from "@/framework/types";
import { getBalance, adjustBalance } from "@/features/economy/mutations";
import { ensureAccount, isAccountActive } from "@/features/economy/account";
import {
  marketStore,
  findActiveListings,
  countActiveListings,
} from "@/db/repositories/economy";
import type { MarketListingDoc } from "@/db/schemas/market";
import { buildListingId } from "@/utils/ids";

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class MarketError extends Error {
  constructor(
    public readonly code:
      | "INVALID_INPUT"
      | "INVALID_PRICE"
      | "INVALID_QUANTITY"
      | "LISTING_NOT_FOUND"
      | "LISTING_NOT_ACTIVE"
      | "LISTING_LIMIT_REACHED"
      | "INSUFFICIENT_FUNDS"
      | "INSUFFICIENT_LISTING_QUANTITY"
      | "SELF_BUY_FORBIDDEN"
      | "COOLDOWN_ACTIVE"
      | "ACCOUNT_INACTIVE"
      | "PERMISSION_DENIED"
      | "TRANSACTION_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "MarketError";
  }
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface MarketConfig {
  readonly maxActiveListings: number;
  readonly createCooldownMs: number;
  readonly buyCooldownMs: number;
  readonly feeRate: number;
  readonly minPrice: number;
  readonly maxPrice: number;
  readonly pageSize: number;
  readonly currencyId: string;
}

export const DEFAULT_MARKET_CONFIG: MarketConfig = {
  maxActiveListings: 20,
  createCooldownMs: 3_000,
  buyCooldownMs: 2_000,
  feeRate: 0.02,
  minPrice: 1,
  maxPrice: 1_000_000,
  pageSize: 10,
  currencyId: "coins",
};

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface CreateListingResult {
  readonly listingId: string;
  readonly itemId: string;
  readonly quantity: number;
  readonly pricePerUnit: number;
}

export interface BuyListingResult {
  readonly listingId: string;
  readonly itemId: string;
  readonly quantity: number;
  readonly subtotal: number;
  readonly fee: number;
  readonly total: number;
  readonly sellerPayout: number;
  readonly buyerNewBalance: number;
  readonly listingRemaining: number;
}

export interface CancelListingResult {
  readonly listingId: string;
  readonly itemId: string;
  readonly returnedQuantity: number;
}

export interface BrowseListingsResult {
  readonly listings: MarketListingDoc[];
  readonly page: number;
  readonly pageSize: number;
}

// ---------------------------------------------------------------------------
// createListing
// ---------------------------------------------------------------------------

export async function createListing(
  ctx: Ctx,
  sellerId: string,
  guildId: string,
  itemId: string,
  quantity: number,
  pricePerUnit: number,
  config?: Partial<MarketConfig>,
): Promise<Result<CreateListingResult, MarketError>> {
  const cfg: MarketConfig = { ...DEFAULT_MARKET_CONFIG, ...config };

  if (!itemId || typeof itemId !== "string") {
    return ErrResult(new MarketError("INVALID_INPUT", "Item ID is required"));
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    return ErrResult(new MarketError("INVALID_QUANTITY", "Quantity must be a positive integer"));
  }

  if (!Number.isInteger(pricePerUnit) || pricePerUnit < cfg.minPrice) {
    return ErrResult(new MarketError("INVALID_PRICE", `Price must be at least ${cfg.minPrice}`));
  }

  if (pricePerUnit > cfg.maxPrice) {
    return ErrResult(new MarketError("INVALID_PRICE", `Price cannot exceed ${cfg.maxPrice}`));
  }

  if (ctx.cooldowns.isOnCooldown(sellerId, "market:create")) {
    const remaining = ctx.cooldowns.getRemainingMs(sellerId, "market:create");
    return ErrResult(new MarketError("COOLDOWN_ACTIVE", `Wait ${remaining}ms before listing again`));
  }

  const account = await ensureAccount(ctx, sellerId);
  if (!isAccountActive(account.status)) {
    return ErrResult(new MarketError("ACCOUNT_INACTIVE", "Your economy account is not active"));
  }

  const countRes = await countActiveListings(guildId, sellerId);
  if (countRes.isErr()) return ErrResult(new MarketError("TRANSACTION_FAILED", countRes.error.message));

  if (countRes.unwrap() >= cfg.maxActiveListings) {
    return ErrResult(
      new MarketError("LISTING_LIMIT_REACHED", `You can have at most ${cfg.maxActiveListings} active listings`),
    );
  }

  // TODO: Deduct quantity from seller inventory when features/inventory is implemented.

  const now = new Date();
  const listing: MarketListingDoc = {
    _id: buildListingId(),
    guildId,
    sellerId,
    itemId,
    itemKind: "stackable",
    pricePerUnit,
    quantity,
    status: "active",
    version: 0,
    createdAt: now,
    updatedAt: now,
    expiresAt: null,
  };

  const saveRes = await marketStore.set(listing._id, listing);
  if (saveRes.isErr()) return ErrResult(new MarketError("TRANSACTION_FAILED", saveRes.error.message));

  ctx.cooldowns.set(sellerId, "market:create", cfg.createCooldownMs);

  return OkResult({ listingId: listing._id, itemId, quantity, pricePerUnit });
}

// ---------------------------------------------------------------------------
// buyListing
// ---------------------------------------------------------------------------

export async function buyListing(
  ctx: Ctx,
  buyerId: string,
  listingId: string,
  quantity: number,
  config?: Partial<MarketConfig>,
): Promise<Result<BuyListingResult, MarketError>> {
  const cfg: MarketConfig = { ...DEFAULT_MARKET_CONFIG, ...config };

  if (!Number.isInteger(quantity) || quantity < 1) {
    return ErrResult(new MarketError("INVALID_QUANTITY", "Quantity must be a positive integer"));
  }

  if (ctx.cooldowns.isOnCooldown(buyerId, "market:buy")) {
    const remaining = ctx.cooldowns.getRemainingMs(buyerId, "market:buy");
    return ErrResult(new MarketError("COOLDOWN_ACTIVE", `Wait ${remaining}ms before buying again`));
  }

  const account = await ensureAccount(ctx, buyerId);
  if (!isAccountActive(account.status)) {
    return ErrResult(new MarketError("ACCOUNT_INACTIVE", "Your economy account is not active"));
  }

  const listingRes = await marketStore.get(listingId);
  if (listingRes.isErr()) return ErrResult(new MarketError("TRANSACTION_FAILED", listingRes.error.message));
  const listing = listingRes.unwrap();

  if (!listing) {
    return ErrResult(new MarketError("LISTING_NOT_FOUND", "Listing not found"));
  }

  if (listing.status !== "active") {
    return ErrResult(new MarketError("LISTING_NOT_ACTIVE", "This listing is no longer available"));
  }

  if (listing.sellerId === buyerId) {
    return ErrResult(new MarketError("SELF_BUY_FORBIDDEN", "You cannot buy your own listing"));
  }

  if (quantity > listing.quantity) {
    return ErrResult(
      new MarketError("INSUFFICIENT_LISTING_QUANTITY", `Only ${listing.quantity} available`),
    );
  }

  const subtotal = quantity * listing.pricePerUnit;
  const fee = Math.floor(subtotal * cfg.feeRate);
  const total = subtotal + fee;
  const sellerPayout = subtotal;

  const balance = await getBalance(ctx, buyerId, cfg.currencyId);
  if (balance < total) {
    return ErrResult(new MarketError("INSUFFICIENT_FUNDS", `You need ${total} ${cfg.currencyId}`));
  }

  // Debit buyer
  let buyerNewBalance: number;
  try {
    buyerNewBalance = await adjustBalance(ctx, buyerId, cfg.currencyId, -total);
  } catch {
    return ErrResult(new MarketError("TRANSACTION_FAILED", "Failed to debit buyer"));
  }

  // Credit seller (payout = subtotal; fee is house edge)
  try {
    await adjustBalance(ctx, listing.sellerId, cfg.currencyId, sellerPayout);
  } catch {
    // Best-effort rollback
    await adjustBalance(ctx, buyerId, cfg.currencyId, total).catch(() => {});
    return ErrResult(new MarketError("TRANSACTION_FAILED", "Failed to credit seller; transaction reversed"));
  }

  // Update listing quantity / status
  const remaining = listing.quantity - quantity;
  const nextStatus = remaining <= 0 ? "sold_out" : "active";
  await marketStore.replaceIfMatch(listingId, { version: listing.version }, {
    quantity: remaining,
    status: nextStatus,
    version: listing.version + 1,
    updatedAt: new Date(),
  });

  // TODO: Add quantity of itemId to buyer inventory when features/inventory is implemented.

  ctx.cooldowns.set(buyerId, "market:buy", cfg.buyCooldownMs);

  return OkResult({
    listingId,
    itemId: listing.itemId,
    quantity,
    subtotal,
    fee,
    total,
    sellerPayout,
    buyerNewBalance,
    listingRemaining: remaining,
  });
}

// ---------------------------------------------------------------------------
// cancelListing
// ---------------------------------------------------------------------------

export async function cancelListing(
  ctx: Ctx,
  actorId: string,
  listingId: string,
  options: { allowModeratorOverride?: boolean } = {},
): Promise<Result<CancelListingResult, MarketError>> {
  void ctx;
  const listingRes = await marketStore.get(listingId);
  if (listingRes.isErr()) return ErrResult(new MarketError("TRANSACTION_FAILED", listingRes.error.message));
  const listing = listingRes.unwrap();

  if (!listing) {
    return ErrResult(new MarketError("LISTING_NOT_FOUND", "Listing not found"));
  }

  if (listing.status !== "active") {
    return ErrResult(new MarketError("LISTING_NOT_ACTIVE", "This listing is no longer active"));
  }

  if (listing.sellerId !== actorId && !options.allowModeratorOverride) {
    return ErrResult(new MarketError("PERMISSION_DENIED", "You do not own this listing"));
  }

  await marketStore.replaceIfMatch(listingId, { version: listing.version }, {
    status: "cancelled",
    version: listing.version + 1,
    updatedAt: new Date(),
  });

  // TODO: Return listing.quantity of listing.itemId to listing.sellerId's inventory.

  return OkResult({
    listingId,
    itemId: listing.itemId,
    returnedQuantity: listing.quantity,
  });
}

// ---------------------------------------------------------------------------
// browseListings
// ---------------------------------------------------------------------------

export async function browseListings(
  ctx: Ctx,
  guildId: string,
  options: { itemId?: string; sellerId?: string; page?: number; pageSize?: number } = {},
  config?: Partial<MarketConfig>,
): Promise<Result<BrowseListingsResult, MarketError>> {
  void ctx;
  const cfg: MarketConfig = { ...DEFAULT_MARKET_CONFIG, ...config };
  const page = Math.max(0, options.page ?? 0);
  const pageSize = options.pageSize ?? cfg.pageSize;
  const skip = page * pageSize;

  const res = await findActiveListings(guildId, {
    itemId: options.itemId,
    sellerId: options.sellerId,
    skip,
    limit: pageSize,
  });

  if (res.isErr()) return ErrResult(new MarketError("TRANSACTION_FAILED", res.error.message));

  return OkResult({ listings: res.unwrap(), page, pageSize });
}
