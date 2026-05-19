import type { MarketListingDoc } from "@/db/schemas/market";

/**
 * Domain error used by market commands and tests.
 * Codes are stable because command handlers and rollback paths branch on them.
 */
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

/**
 * Runtime-tunable limits for marketplace behavior.
 * Command callers pass partial overrides; the service merges them with defaults.
 */
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

/** Default market policy used when guild-specific config is absent. */
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

/**
 * Market currently escrows only stackable inventory.
 * Instance-item sales need a separate ownership model and are intentionally rejected.
 */
export const STACKABLE_ITEM_KIND = "stackable" as const;

/** Successful listing creation summary returned to Discord command handlers. */
export interface CreateListingResult {
  readonly listingId: string;
  readonly itemId: string;
  readonly quantity: number;
  readonly pricePerUnit: number;
}

/** Successful purchase summary, including money movement and remaining listing quantity. */
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

/** Successful cancellation summary used to report escrow returned to the seller. */
export interface CancelListingResult {
  readonly listingId: string;
  readonly itemId: string;
  readonly returnedQuantity: number;
}

/** Paged active-listing browse result. */
export interface BrowseListingsResult {
  readonly listings: MarketListingDoc[];
  readonly page: number;
  readonly pageSize: number;
}
