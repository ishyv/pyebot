/**
 * Pure marketplace transition helpers.
 *
 * The command-facing market service owns orchestration and side effects; this
 * module owns deterministic decisions that should be easy to test without Mongo
 * or Discord. Keep validation, pricing, and listing patch construction here so
 * rollback logic in `market.ts` can refer to one canonical transition shape.
 *
 * Limits: only stackable item listings are supported. Instance items need a
 * different escrow and identity model, not a boolean flag slipped in here.
 */
import type { MarketListingDoc } from "@/components/economy/market-listing";
import {
  DEFAULT_MARKET_CONFIG,
  type MarketConfig,
  MarketError,
  STACKABLE_ITEM_KIND,
} from "./market-types";

/**
 * Merge runtime overrides with default market policy.
 * Keeps every command path on the same config normalization rule.
 */
export function resolveMarketConfig(config?: Partial<MarketConfig>): MarketConfig {
  return { ...DEFAULT_MARKET_CONFIG, ...config };
}

/**
 * Convert unknown rollback failures into the market error contract.
 * Domain errors keep their code; infrastructure failures become transaction failures.
 */
export function asMarketError(error: unknown, fallback: string): MarketError {
  return error instanceof MarketError
    ? error
    : new MarketError("TRANSACTION_FAILED", error instanceof Error ? error.message : fallback);
}

/** Build the standard conflict error for stale listing writes. */
export function marketConflict(
  message = "Listing changed before the transaction completed",
): MarketError {
  return new MarketError("TRANSACTION_FAILED", message);
}

/**
 * Validate user-controlled listing creation fields before escrow happens.
 * Returns null when the fields are safe to use.
 *
 * Precondition: item existence is validated by the caller's inventory escrow;
 * this function only validates scalar request shape and market policy limits.
 */
export function validateCreateListingInput(
  itemId: string,
  quantity: number,
  pricePerUnit: number,
  config: MarketConfig,
): MarketError | null {
  if (!itemId || typeof itemId !== "string") {
    return new MarketError("INVALID_INPUT", "Item ID is required");
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    return new MarketError("INVALID_QUANTITY", "Quantity must be a positive integer");
  }
  if (!Number.isInteger(pricePerUnit) || pricePerUnit < config.minPrice) {
    return new MarketError("INVALID_PRICE", `Price must be at least ${config.minPrice}`);
  }
  if (pricePerUnit > config.maxPrice) {
    return new MarketError("INVALID_PRICE", `Price cannot exceed ${config.maxPrice}`);
  }
  return null;
}

/**
 * Validate purchase request shape before loading or mutating a listing.
 * Quantity is the only buyer-controlled scalar at this boundary.
 */
export function validatePurchaseQuantity(quantity: number): MarketError | null {
  if (!Number.isInteger(quantity) || quantity < 1) {
    return new MarketError("INVALID_QUANTITY", "Quantity must be a positive integer");
  }
  return null;
}

/**
 * Validate the loaded listing against the buyer request.
 * Assumes the listing came from the trusted listing store parser.
 */
export function validateBuyableListing(
  listing: MarketListingDoc,
  buyerId: string,
  quantity: number,
): MarketError | null {
  if (listing.status !== "active") {
    return new MarketError("LISTING_NOT_ACTIVE", "This listing is no longer available");
  }
  if (listing.sellerId === buyerId) {
    return new MarketError("SELF_BUY_FORBIDDEN", "You cannot buy your own listing");
  }
  if (quantity > listing.quantity) {
    return new MarketError("INSUFFICIENT_LISTING_QUANTITY", `Only ${listing.quantity} available`);
  }
  if (listing.itemKind !== STACKABLE_ITEM_KIND) {
    return new MarketError("INVALID_INPUT", "Only stackable item listings are supported");
  }
  return null;
}

/**
 * Validate whether a caller may cancel a listing.
 * Moderator override is explicit so normal seller ownership stays obvious.
 */
export function validateCancellableListing(
  listing: MarketListingDoc,
  actorId: string,
  allowModeratorOverride = false,
): MarketError | null {
  if (listing.status !== "active") {
    return new MarketError("LISTING_NOT_ACTIVE", "This listing is no longer active");
  }
  if (listing.sellerId !== actorId && !allowModeratorOverride) {
    return new MarketError("PERMISSION_DENIED", "You do not own this listing");
  }
  return null;
}

/**
 * Calculate the buyer charge and seller payout for a listing purchase.
 * Fees are intentionally floored to preserve existing command behavior.
 *
 * RISK: changing fee rounding is an economy behavior change. Update tests,
 * commands, and decision log if the policy changes.
 */
export function calculatePurchase(
  listing: MarketListingDoc,
  quantity: number,
  config: MarketConfig,
): {
  readonly subtotal: number;
  readonly fee: number;
  readonly total: number;
  readonly sellerPayout: number;
} {
  const subtotal = quantity * listing.pricePerUnit;
  const fee = Math.floor(subtotal * config.feeRate);
  return {
    subtotal,
    fee,
    total: subtotal + fee,
    sellerPayout: subtotal,
  };
}

/**
 * Return the CAS patch for consuming quantity from a listing.
 * The caller owns persistence and rollback; this function owns the transition.
 *
 * Postcondition: quantity reaches zero only with `sold_out`; partial purchases
 * keep the listing active.
 */
export function purchaseListingPatch(
  listing: MarketListingDoc,
  quantity: number,
): Pick<MarketListingDoc, "quantity" | "status" | "version" | "updatedAt"> {
  const remaining = listing.quantity - quantity;
  return {
    quantity: remaining,
    status: remaining <= 0 ? "sold_out" : "active",
    version: listing.version + 1,
    updatedAt: new Date(),
  };
}

/**
 * Return the CAS patch for cancelling an active listing.
 * Escrow return happens after this patch succeeds.
 *
 * WHY: status changes before inventory return so a concurrent buyer cannot
 * consume the listing while cancellation is returning escrow.
 */
export function cancelListingPatch(
  listing: MarketListingDoc,
): Pick<MarketListingDoc, "status" | "version" | "updatedAt"> {
  return {
    status: "cancelled",
    version: listing.version + 1,
    updatedAt: new Date(),
  };
}

/**
 * Build the snapshot patch used to reverse a partially-applied listing update.
 * WHY: rollback must restore the exact pre-transaction quantity/status/version.
 * RISK: adding fields here without matching CAS expectations can hide conflicts.
 */
export function listingSnapshotPatch(
  listing: MarketListingDoc,
): Pick<MarketListingDoc, "quantity" | "status" | "version" | "updatedAt"> {
  return {
    quantity: listing.quantity,
    status: listing.status,
    version: listing.version,
    updatedAt: listing.updatedAt,
  };
}
