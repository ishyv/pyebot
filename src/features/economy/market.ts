/**
 * Economy marketplace: create, buy, cancel, browse listings.
 *
 * This module is the orchestration boundary for command-facing market actions.
 * Pure listing validation/pricing lives in `market-transitions`; legacy listing
 * persistence is hidden behind `market-listing-store`.
 *
 * Invariants:
 * - Seller inventory is escrowed before a listing is saved.
 * - Purchases mutate listings with version CAS before seller credit.
 * - Any post-CAS failure attempts to reverse money and listing state.
 *
 * It does not change command UX or support instance-item listings yet.
 */

import { UserInventory } from "@/components/user-inventory";
import { ErrResult, OkResult, type Result } from "@/core/result";
import type { MarketListingDoc } from "@/db/schemas/market";
import { ensureAccount, isAccountActive } from "@/features/economy/account";
import { adjustBalance, getBalance } from "@/features/economy/mutations";
import type { Ctx } from "@/framework/types";
import { buildListingId } from "@/utils/ids";
import { marketListingStore } from "./market-listing-store";
import {
  asMarketError,
  calculatePurchase,
  cancelListingPatch,
  marketConflict,
  purchaseListingPatch,
  resolveMarketConfig,
  validateBuyableListing,
  validateCancellableListing,
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
    // WHY: listing operations mix DB writes with component updates. The
    // process-local lock prevents two interactions in this process from
    // interleaving their rollback paths; version CAS still guards Mongo.
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
  await marketListingStore.restoreSnapshot(listing, expectedVersion).catch(() => {});
}

// ---------------------------------------------------------------------------
// createListing
// ---------------------------------------------------------------------------

/**
 * Creates a stackable-item listing after reserving seller inventory.
 * Side effects: reads account state, mutates `UserInventory`, writes the legacy listing store,
 * and sets the create cooldown only after the listing is saved.
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

  const account = await ensureAccount(ctx, sellerId);
  if (!isAccountActive(account.status)) {
    return ErrResult(new MarketError("ACCOUNT_INACTIVE", "Your economy account is not active"));
  }

  const countRes = await marketListingStore.countActive(guildId, sellerId);
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

  const saveRes = await marketListingStore.save(listing);
  if (saveRes.isErr()) {
    // RISK: inventory escrow has already happened. Restore best-effort and
    // surface the listing failure; do not leave the listing half-created.
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

/**
 * Buys quantity from an active listing with per-listing locking and CAS.
 * Side effects: debits buyer, updates listing quantity/status, credits seller,
 * grants buyer inventory, and rolls back best-effort if a later step fails.
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

  const account = await ensureAccount(ctx, buyerId);
  if (!isAccountActive(account.status)) {
    return ErrResult(new MarketError("ACCOUNT_INACTIVE", "Your economy account is not active"));
  }

  return withListingLock(ctx, listingId, async () => {
    const listingRes = await marketListingStore.get(listingId);
    if (listingRes.isErr())
      return ErrResult(new MarketError("TRANSACTION_FAILED", listingRes.error.message));
    const listing = listingRes.unwrap();

    if (!listing) {
      return ErrResult(new MarketError("LISTING_NOT_FOUND", "Listing not found"));
    }

    const listingError = validateBuyableListing(listing, buyerId, quantity);
    if (listingError) return ErrResult(listingError);

    const { subtotal, fee, total, sellerPayout } = calculatePurchase(listing, quantity, cfg);

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

    const listingPatch = purchaseListingPatch(listing, quantity);
    const updateRes = await marketListingStore.replaceIfVersion(
      listingId,
      listing.version,
      listingPatch,
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
      // WHY: after listing CAS succeeds, buyer money has moved but seller credit
      // failed. Reverse buyer debit and listing quantity/status before reporting.
      await rollbackBalance(ctx, buyerId, cfg.currencyId, total);
      await rollbackListing(listing, listing.version + 1);
      return ErrResult(
        new MarketError("TRANSACTION_FAILED", "Failed to credit seller; transaction reversed"),
      );
    }

    try {
      await addStackItems(ctx, buyerId, listing.itemId, quantity);
    } catch (error) {
      // RISK: this is the widest rollback path: seller credit, buyer debit, and
      // listing state all need reversal. Each rollback is best-effort because
      // the code is not inside a multi-document Mongo transaction.
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
      listingRemaining: listingPatch.quantity,
    });
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
    const listingRes = await marketListingStore.get(listingId);
    if (listingRes.isErr())
      return ErrResult(new MarketError("TRANSACTION_FAILED", listingRes.error.message));
    const listing = listingRes.unwrap();

    if (!listing) {
      return ErrResult(new MarketError("LISTING_NOT_FOUND", "Listing not found"));
    }

    const listingError = validateCancellableListing(
      listing,
      actorId,
      options.allowModeratorOverride,
    );
    if (listingError) return ErrResult(listingError);

    const updateRes = await marketListingStore.replaceIfVersion(
      listingId,
      listing.version,
      cancelListingPatch(listing),
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
      // WHY: the listing is already marked cancelled. Restoring the snapshot is
      // safer than leaving escrow stuck when inventory return fails.
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

  const res = await marketListingStore.findActive(guildId, {
    itemId: options.itemId,
    sellerId: options.sellerId,
    skip,
    limit: pageSize,
  });

  if (res.isErr()) return ErrResult(new MarketError("TRANSACTION_FAILED", res.error.message));

  return OkResult({ listings: res.unwrap(), page, pageSize });
}
