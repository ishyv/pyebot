/**
 * Economy marketplace: create, buy, cancel, browse listings.
 *
 * Architecture: Plain exported async functions — no classes (except MarketError).
 * Dependencies: ctx for cooldowns + mutations, ensureAccount/isAccountActive from account,
 *   marketStore/query helpers from economy repo.
 */

import { UserInventory } from "@/components/user-inventory";
import { ErrResult, OkResult, type Result } from "@/core/result";
import { countActiveListings, findActiveListings, marketStore } from "@/db/repositories/economy";
import type { MarketListingDoc } from "@/db/schemas/market";
import { ensureAccount, isAccountActive } from "@/features/economy/account";
import { adjustBalance, getBalance } from "@/features/economy/mutations";
import type { Ctx } from "@/framework/types";
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
      | "INSUFFICIENT_INVENTORY"
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

const STACKABLE_ITEM_KIND = "stackable" as const;

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

function marketConflict(message = "Listing changed before the transaction completed"): MarketError {
  return new MarketError("TRANSACTION_FAILED", message);
}

function asMarketError(error: unknown, fallback: string): MarketError {
  return error instanceof MarketError
    ? error
    : new MarketError("TRANSACTION_FAILED", error instanceof Error ? error.message : fallback);
}

function stackQuantity(slot: unknown): number {
  if (!slot || typeof slot !== "object") return 0;
  if ("qty" in slot && typeof slot.qty === "number") return slot.qty;
  return 0;
}

async function getStackQuantity(ctx: Ctx, userId: string, itemId: string): Promise<number> {
  const inventory = await ctx.get(userId, UserInventory);
  return stackQuantity(inventory?.slots[itemId]);
}

async function addStackItems(
  ctx: Ctx,
  userId: string,
  itemId: string,
  quantity: number,
): Promise<void> {
  if (quantity <= 0) return;
  const current = await getStackQuantity(ctx, userId, itemId);
  await ctx.patch(userId, UserInventory, (inventory) => ({
    slots: { ...inventory.slots, [itemId]: { qty: current + quantity } },
  }));
}

async function removeStackItems(
  ctx: Ctx,
  userId: string,
  itemId: string,
  quantity: number,
): Promise<void> {
  if (quantity <= 0) return;
  const current = await getStackQuantity(ctx, userId, itemId);
  if (current < quantity) {
    throw new MarketError(
      "INSUFFICIENT_INVENTORY",
      `You need ${quantity} ${itemId}, but only have ${current}`,
    );
  }
  await ctx.patch(userId, UserInventory, (inventory) => ({
    slots: { ...inventory.slots, [itemId]: { qty: current - quantity } },
  }));
}

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
    ctx.locks.release(key);
  }
}

async function rollbackBalance(
  ctx: Ctx,
  userId: string,
  currencyId: string,
  delta: number,
): Promise<void> {
  await adjustBalance(ctx, userId, currencyId, delta, { allowDebt: true }).catch((error) => {
    ctx.logger.error("Failed to roll back market balance", error);
  });
}

async function rollbackListing(listing: MarketListingDoc, expectedVersion: number): Promise<void> {
  await marketStore
    .replaceIfMatch(
      listing._id,
      { version: expectedVersion },
      {
        quantity: listing.quantity,
        status: listing.status,
        version: listing.version,
        updatedAt: listing.updatedAt,
      },
    )
    .catch(() => {});
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
    return ErrResult(
      new MarketError("COOLDOWN_ACTIVE", `Wait ${remaining}ms before listing again`),
    );
  }

  const account = await ensureAccount(ctx, sellerId);
  if (!isAccountActive(account.status)) {
    return ErrResult(new MarketError("ACCOUNT_INACTIVE", "Your economy account is not active"));
  }

  const countRes = await countActiveListings(guildId, sellerId);
  if (countRes.isErr())
    return ErrResult(new MarketError("TRANSACTION_FAILED", countRes.error.message));

  if (countRes.unwrap() >= cfg.maxActiveListings) {
    return ErrResult(
      new MarketError(
        "LISTING_LIMIT_REACHED",
        `You can have at most ${cfg.maxActiveListings} active listings`,
      ),
    );
  }

  try {
    await removeStackItems(ctx, sellerId, itemId, quantity);
  } catch (error) {
    return ErrResult(asMarketError(error, "Failed to reserve inventory"));
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

  const saveRes = await marketStore.set(listing._id, listing);
  if (saveRes.isErr()) {
    await addStackItems(ctx, sellerId, itemId, quantity).catch((error) => {
      ctx.logger.error("Failed to restore inventory after listing save failure", error);
    });
    return ErrResult(new MarketError("TRANSACTION_FAILED", saveRes.error.message));
  }

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

  return withListingLock(ctx, listingId, async () => {
    const listingRes = await marketStore.get(listingId);
    if (listingRes.isErr())
      return ErrResult(new MarketError("TRANSACTION_FAILED", listingRes.error.message));
    const listing = listingRes.unwrap();

    if (!listing) {
      return ErrResult(new MarketError("LISTING_NOT_FOUND", "Listing not found"));
    }

    if (listing.status !== "active") {
      return ErrResult(
        new MarketError("LISTING_NOT_ACTIVE", "This listing is no longer available"),
      );
    }

    if (listing.sellerId === buyerId) {
      return ErrResult(new MarketError("SELF_BUY_FORBIDDEN", "You cannot buy your own listing"));
    }

    if (quantity > listing.quantity) {
      return ErrResult(
        new MarketError("INSUFFICIENT_LISTING_QUANTITY", `Only ${listing.quantity} available`),
      );
    }

    if (listing.itemKind !== STACKABLE_ITEM_KIND) {
      return ErrResult(
        new MarketError("INVALID_INPUT", "Only stackable item listings are supported"),
      );
    }

    const subtotal = quantity * listing.pricePerUnit;
    const fee = Math.floor(subtotal * cfg.feeRate);
    const total = subtotal + fee;
    const sellerPayout = subtotal;

    const balance = await getBalance(ctx, buyerId, cfg.currencyId);
    if (balance < total) {
      return ErrResult(
        new MarketError("INSUFFICIENT_FUNDS", `You need ${total} ${cfg.currencyId}`),
      );
    }

    let buyerNewBalance: number;
    try {
      buyerNewBalance = await adjustBalance(ctx, buyerId, cfg.currencyId, -total);
    } catch {
      return ErrResult(new MarketError("TRANSACTION_FAILED", "Failed to debit buyer"));
    }

    const remaining = listing.quantity - quantity;
    const nextStatus = remaining <= 0 ? "sold_out" : "active";
    const updateRes = await marketStore.replaceIfMatch(
      listingId,
      { version: listing.version },
      {
        quantity: remaining,
        status: nextStatus,
        version: listing.version + 1,
        updatedAt: new Date(),
      },
    );
    if (updateRes.isErr()) {
      await rollbackBalance(ctx, buyerId, cfg.currencyId, total);
      return ErrResult(new MarketError("TRANSACTION_FAILED", updateRes.error.message));
    }
    if (!updateRes.unwrap()) {
      await rollbackBalance(ctx, buyerId, cfg.currencyId, total);
      return ErrResult(marketConflict());
    }

    try {
      await adjustBalance(ctx, listing.sellerId, cfg.currencyId, sellerPayout);
    } catch {
      await rollbackBalance(ctx, buyerId, cfg.currencyId, total);
      await rollbackListing(listing, listing.version + 1);
      return ErrResult(
        new MarketError("TRANSACTION_FAILED", "Failed to credit seller; transaction reversed"),
      );
    }

    try {
      await addStackItems(ctx, buyerId, listing.itemId, quantity);
    } catch (error) {
      await rollbackBalance(ctx, listing.sellerId, cfg.currencyId, -sellerPayout);
      await rollbackBalance(ctx, buyerId, cfg.currencyId, total);
      await rollbackListing(listing, listing.version + 1);
      return ErrResult(asMarketError(error, "Failed to grant inventory; transaction reversed"));
    }

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
  return withListingLock(ctx, listingId, async () => {
    const listingRes = await marketStore.get(listingId);
    if (listingRes.isErr())
      return ErrResult(new MarketError("TRANSACTION_FAILED", listingRes.error.message));
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

    const updateRes = await marketStore.replaceIfMatch(
      listingId,
      { version: listing.version },
      {
        status: "cancelled",
        version: listing.version + 1,
        updatedAt: new Date(),
      },
    );
    if (updateRes.isErr()) {
      return ErrResult(new MarketError("TRANSACTION_FAILED", updateRes.error.message));
    }
    if (!updateRes.unwrap()) {
      return ErrResult(marketConflict());
    }

    try {
      await addStackItems(ctx, listing.sellerId, listing.itemId, listing.quantity);
    } catch (error) {
      await rollbackListing(listing, listing.version + 1);
      return ErrResult(asMarketError(error, "Failed to return inventory"));
    }

    return OkResult({
      listingId,
      itemId: listing.itemId,
      returnedQuantity: listing.quantity,
    });
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
