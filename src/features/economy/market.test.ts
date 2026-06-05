/**
 * Tests for economy marketplace (createListing, buyListing, cancelListing, browseListings).
 * Mocks state, userStore, and economy repo — no real DB required.
 *
 * NOTE: We mock @/db/repositories/users and @/db/repositories/economy (not service layers)
 * to avoid Bun module mock cross-contamination with mutations.test.ts and minigames.test.ts.
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { MarketListingDoc } from "@/components/economy/market-listing";
import { ErrResult, OkResult } from "@/core/result";
import type { User } from "@/db/schemas/user";
import {
  calculatePurchase,
  cancelListingPatch,
  purchaseListingPatch,
  validateBuyableListing,
  validateCancellableListing,
} from "./market-transitions";
import { type MarketConfig, MarketError as MarketDomainError } from "./market-types";

// ---------------------------------------------------------------------------
// Cooldown spies used by the ctx stub.
// ---------------------------------------------------------------------------

const mockIsOnCooldown = mock((_userId: string, _key: string) => false);
const mockGetRemainingMs = mock((_userId: string, _key: string) => 0);
const mockSetCooldown = mock((_userId: string, _key: string, _ms: number) => {});

const NOW = new Date("2026-01-01T00:00:00.000Z");

// ---------------------------------------------------------------------------
// Mock @/db/repositories/users BEFORE importing market
// (mutations.ts uses userStore directly)
// ---------------------------------------------------------------------------

function makeUser(_currency: Record<string, number> = { coins: 500 }): User {
  return {
    _id: "user-1",
    sanction_history: {},
    mod_notes: {},
    quarantine_roles: {},
  };
}

const mockUserGet = mock(async (_id: string) => OkResult<User | null>(makeUser()));
const mockUserEnsure = mock(async (_id: string) => OkResult(makeUser()));
const mockUserUpdatePaths = mock(async (_id: string, _paths: Record<string, unknown>) =>
  OkResult(undefined as undefined),
);

mock.module("@/db/repositories/users", () => ({
  userStore: {
    get: mockUserGet,
    ensure: mockUserEnsure,
    updatePaths: mockUserUpdatePaths,
  },
}));

// ---------------------------------------------------------------------------
// Mock @/db/repositories/economy BEFORE importing market
// ---------------------------------------------------------------------------

const listingStore = new Map<string, MarketListingDoc>();

function makeListing(overrides: Partial<MarketListingDoc> = {}): MarketListingDoc {
  return {
    _id: "listing:test-1",
    guildId: "guild-1",
    sellerId: "seller-1",
    itemId: "wood",
    itemKind: "stackable",
    pricePerUnit: 10,
    quantity: 50,
    status: "active",
    version: 0,
    createdAt: NOW,
    updatedAt: NOW,
    expiresAt: null,
    ...overrides,
  };
}

const mockMarketGet = mock(async (id: string) => {
  const doc = listingStore.get(id);
  return OkResult<MarketListingDoc | null>(doc ?? null);
});
const mockMarketSet = mock(async (_id: string, doc: MarketListingDoc) => {
  listingStore.set(doc._id, doc);
  return OkResult(doc);
});
const mockMarketReplaceIfMatch = mock(
  async (id: string, expected: Partial<MarketListingDoc>, next: Partial<MarketListingDoc>) => {
    const existing = listingStore.get(id);
    if (!existing) return OkResult<MarketListingDoc | null>(null);
    if (
      Object.entries(expected).some(
        ([key, value]) => existing[key as keyof MarketListingDoc] !== value,
      )
    ) {
      return OkResult<MarketListingDoc | null>(null);
    }
    const updated = { ...existing, ...next };
    listingStore.set(id, updated);
    return OkResult<MarketListingDoc | null>(updated);
  },
);
const mockFindActiveListings = mock(async (_guildId: string, _opts?: unknown) =>
  OkResult(Array.from(listingStore.values()).filter((l) => l.status === "active")),
);
const mockCountActiveListings = mock(async (_guildId: string, _sellerId: string) => OkResult(0));

mock.module("@/db/repositories/economy", () => ({
  marketStore: {
    get: mockMarketGet,
    set: mockMarketSet,
    replaceIfMatch: mockMarketReplaceIfMatch,
    collection: mock(async () => {
      throw new Error("collection() not mocked");
    }),
  },
  findActiveListings: mockFindActiveListings,
  countActiveListings: mockCountActiveListings,
  // achievement store stubs (not used in market tests)
  achievementProgressStore: {
    get: mock(async () => OkResult(null)),
    set: mock(async () => OkResult(null)),
  },
  achievementUnlocksStore: {
    get: mock(async () => OkResult(null)),
    set: mock(async () => OkResult(null)),
  },
  getUnlocksForUser: mock(async () => OkResult([])),
  getProgressForUser: mock(async () => OkResult([])),
}));

let activeWallets: Record<string, Record<string, number>> = {};
let activeInventories: Record<string, Record<string, number>> = {};
let activeFailCurrency = new Set<string>();
let activeFailInventory = new Set<string>();

const mockCreateListingTx = mock(
  async (
    _ctx: unknown,
    { listing, config }: { listing: MarketListingDoc; config: MarketConfig },
  ) => {
    if (Array.from(listingStore.values()).filter((doc) => doc.status === "active").length >= 20) {
      return ErrResult(
        new MarketDomainError(
          "LISTING_LIMIT_REACHED",
          `You can have at most ${config.maxActiveListings} active listings`,
        ),
      );
    }
    const current = activeInventories[listing.sellerId]?.[listing.itemId] ?? 0;
    if (current < listing.quantity) {
      return ErrResult(
        new MarketDomainError(
          "INSUFFICIENT_INVENTORY",
          `You need ${listing.quantity} ${listing.itemId}, but do not have enough`,
        ),
      );
    }
    activeInventories[listing.sellerId] = {
      ...activeInventories[listing.sellerId],
      [listing.itemId]: current - listing.quantity,
    };
    listingStore.set(listing._id, listing);
    return OkResult({
      listingId: listing._id,
      itemId: listing.itemId,
      quantity: listing.quantity,
      pricePerUnit: listing.pricePerUnit,
    });
  },
);

const mockBuyListingTx = mock(
  async (
    _ctx: unknown,
    {
      buyerId,
      listingId,
      quantity,
      config,
    }: {
      buyerId: string;
      listingId: string;
      quantity: number;
      config: MarketConfig;
    },
  ) => {
    const listing = listingStore.get(listingId);
    if (!listing) return ErrResult(new MarketDomainError("LISTING_NOT_FOUND", "Listing not found"));
    const listingError = validateBuyableListing(listing, buyerId, quantity);
    if (listingError) return ErrResult(listingError);

    const purchase = calculatePurchase(listing, quantity, config);
    const buyerBalance = activeWallets[buyerId]?.[config.currencyId] ?? 0;
    if (buyerBalance < purchase.total) {
      return ErrResult(
        new MarketDomainError(
          "INSUFFICIENT_FUNDS",
          `You need ${purchase.total} ${config.currencyId}`,
        ),
      );
    }
    if (activeFailCurrency.has(listing.sellerId) || activeFailInventory.has(buyerId)) {
      return ErrResult(new MarketDomainError("TRANSACTION_FAILED", "transaction aborted"));
    }

    activeWallets[buyerId] = {
      ...activeWallets[buyerId],
      [config.currencyId]: buyerBalance - purchase.total,
    };
    activeWallets[listing.sellerId] = {
      ...activeWallets[listing.sellerId],
      [config.currencyId]:
        (activeWallets[listing.sellerId]?.[config.currencyId] ?? 0) + purchase.sellerPayout,
    };
    activeInventories[buyerId] = {
      ...activeInventories[buyerId],
      [listing.itemId]: (activeInventories[buyerId]?.[listing.itemId] ?? 0) + quantity,
    };
    const listingPatch = purchaseListingPatch(listing, quantity);
    listingStore.set(listingId, { ...listing, ...listingPatch });

    return OkResult({
      listingId,
      itemId: listing.itemId,
      quantity,
      ...purchase,
      buyerNewBalance: activeWallets[buyerId]?.[config.currencyId] ?? 0,
      listingRemaining: listingPatch.quantity,
    });
  },
);

const mockCancelListingTx = mock(
  async (
    _ctx: unknown,
    {
      actorId,
      listingId,
      allowModeratorOverride,
    }: {
      actorId: string;
      listingId: string;
      allowModeratorOverride?: boolean;
    },
  ) => {
    const listing = listingStore.get(listingId);
    if (!listing) return ErrResult(new MarketDomainError("LISTING_NOT_FOUND", "Listing not found"));
    const listingError = validateCancellableListing(listing, actorId, allowModeratorOverride);
    if (listingError) return ErrResult(listingError);
    if (activeFailInventory.has(listing.sellerId)) {
      return ErrResult(new MarketDomainError("TRANSACTION_FAILED", "transaction aborted"));
    }

    listingStore.set(listingId, { ...listing, ...cancelListingPatch(listing) });
    activeInventories[listing.sellerId] = {
      ...activeInventories[listing.sellerId],
      [listing.itemId]:
        (activeInventories[listing.sellerId]?.[listing.itemId] ?? 0) + listing.quantity,
    };
    return OkResult({
      listingId,
      itemId: listing.itemId,
      returnedQuantity: listing.quantity,
    });
  },
);

const mockFindActiveMarketListings = mock(
  async (
    _ctx: unknown,
    guildId: string,
    options: { itemId?: string; sellerId?: string; limit?: number; skip?: number } = {},
  ) =>
    OkResult(
      Array.from(listingStore.values()).filter(
        (listing) =>
          listing.guildId === guildId &&
          listing.status === "active" &&
          (!options.itemId || listing.itemId === options.itemId) &&
          (!options.sellerId || listing.sellerId === options.sellerId),
      ),
    ),
);

mock.module("./market-persistence", () => ({
  createListingTx: mockCreateListingTx,
  buyListingTx: mockBuyListingTx,
  cancelListingTx: mockCancelListingTx,
  findActiveMarketListings: mockFindActiveMarketListings,
  MarketPersistenceError: class MarketPersistenceError extends Error {
    readonly code = "TRANSACTION_UNSUPPORTED";
  },
}));

// ---------------------------------------------------------------------------
// Ctx stub (wires mock cooldowns + in-memory wallets for mutations)
// ---------------------------------------------------------------------------

function makeCtx(
  wallets: Record<string, Record<string, number>> = {},
  inventories: Record<string, Record<string, number>> = {},
  options: { failCurrencyPatchForUser?: string[]; failInventoryPatchForUser?: string[] } = {},
) {
  const walletStore = wallets;
  const inventoryStore = inventories;
  const locks = new Set<string>();
  const failCurrency = new Set(options.failCurrencyPatchForUser ?? []);
  const failInventory = new Set(options.failInventoryPatchForUser ?? []);
  activeWallets = walletStore;
  activeInventories = inventoryStore;
  activeFailCurrency = failCurrency;
  activeFailInventory = failInventory;
  return {
    cooldowns: {
      isOnCooldown: mockIsOnCooldown,
      getRemainingMs: mockGetRemainingMs,
      set: mockSetCooldown,
    },
    sessions: { get: () => undefined, set: () => {}, delete: () => {}, has: () => false },
    locks: {
      tryAcquire: (key: string) => {
        if (locks.has(key)) return false;
        locks.add(key);
        return true;
      },
      release: (key: string) => {
        locks.delete(key);
      },
      isHeld: (key: string) => locks.has(key),
    },
    client: {} as never,
    logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} } as never,
    interaction: null,
    emit: async () => {},
    get: async () => null,
    ensure: async () => {
      throw new Error("legacy ensure should not be used in market tests");
    },
    patch: async () => {
      throw new Error("legacy patch should not be used in market tests");
    },
    set: async () => {},
    delete: async () => {},
    query: async () => [],
  } as unknown as import("@/framework/types").Ctx;
}

// ---------------------------------------------------------------------------
// Import AFTER mocking
// ---------------------------------------------------------------------------

const { createListing, buyListing, cancelListing, browseListings, MarketError } = await import(
  "./market"
);

// ---------------------------------------------------------------------------
// Reset helpers
// ---------------------------------------------------------------------------

function resetAll() {
  mockIsOnCooldown.mockReset();
  mockGetRemainingMs.mockReset();
  mockSetCooldown.mockReset();
  mockUserGet.mockReset();
  mockUserEnsure.mockReset();
  mockUserUpdatePaths.mockReset();
  mockMarketGet.mockReset();
  mockMarketSet.mockReset();
  mockMarketReplaceIfMatch.mockReset();
  mockFindActiveListings.mockReset();
  mockCountActiveListings.mockReset();
  mockCreateListingTx.mockReset();
  mockBuyListingTx.mockReset();
  mockCancelListingTx.mockReset();
  mockFindActiveMarketListings.mockReset();
  listingStore.clear();

  // Restore defaults
  mockIsOnCooldown.mockImplementation(() => false);
  mockGetRemainingMs.mockImplementation(() => 0);
  mockSetCooldown.mockImplementation(() => {});
  mockUserGet.mockImplementation(async () => OkResult<User | null>(makeUser()));
  mockUserEnsure.mockImplementation(async () => OkResult(makeUser()));
  mockUserUpdatePaths.mockImplementation(async () => OkResult(undefined as undefined));
  mockMarketGet.mockImplementation(async (id: string) => {
    const doc = listingStore.get(id);
    return OkResult<MarketListingDoc | null>(doc ?? null);
  });
  mockMarketSet.mockImplementation(async (_id: string, doc: MarketListingDoc) => {
    listingStore.set(doc._id, doc);
    return OkResult(doc);
  });
  mockMarketReplaceIfMatch.mockImplementation(
    async (id: string, expected: Partial<MarketListingDoc>, next: Partial<MarketListingDoc>) => {
      const existing = listingStore.get(id);
      if (!existing) return OkResult<MarketListingDoc | null>(null);
      if (
        Object.entries(expected).some(
          ([key, value]) => existing[key as keyof MarketListingDoc] !== value,
        )
      ) {
        return OkResult<MarketListingDoc | null>(null);
      }
      const updated = { ...existing, ...next };
      listingStore.set(id, updated);
      return OkResult<MarketListingDoc | null>(updated);
    },
  );
  mockFindActiveListings.mockImplementation(async (_guildId: string) =>
    OkResult(Array.from(listingStore.values()).filter((l) => l.status === "active")),
  );
  mockCountActiveListings.mockImplementation(async () => OkResult(0));
  activeWallets = {};
  activeInventories = {};
  activeFailCurrency = new Set();
  activeFailInventory = new Set();
  mockCreateListingTx.mockImplementation(
    async (
      _ctx: unknown,
      { listing, config }: { listing: MarketListingDoc; config: MarketConfig },
    ) => {
      if (
        Array.from(listingStore.values()).filter(
          (doc) =>
            doc.guildId === listing.guildId &&
            doc.sellerId === listing.sellerId &&
            doc.status === "active",
        ).length >= config.maxActiveListings
      ) {
        return ErrResult(
          new MarketDomainError(
            "LISTING_LIMIT_REACHED",
            `You can have at most ${config.maxActiveListings} active listings`,
          ),
        );
      }
      const current = activeInventories[listing.sellerId]?.[listing.itemId] ?? 0;
      if (current < listing.quantity) {
        return ErrResult(
          new MarketDomainError(
            "INSUFFICIENT_INVENTORY",
            `You need ${listing.quantity} ${listing.itemId}, but do not have enough`,
          ),
        );
      }
      activeInventories[listing.sellerId] = {
        ...activeInventories[listing.sellerId],
        [listing.itemId]: current - listing.quantity,
      };
      listingStore.set(listing._id, listing);
      return OkResult({
        listingId: listing._id,
        itemId: listing.itemId,
        quantity: listing.quantity,
        pricePerUnit: listing.pricePerUnit,
      });
    },
  );
  mockBuyListingTx.mockImplementation(
    async (
      _ctx: unknown,
      {
        buyerId,
        listingId,
        quantity,
        config,
      }: {
        buyerId: string;
        listingId: string;
        quantity: number;
        config: MarketConfig;
      },
    ) => {
      const listing = listingStore.get(listingId);
      if (!listing)
        return ErrResult(new MarketDomainError("LISTING_NOT_FOUND", "Listing not found"));
      const listingError = validateBuyableListing(listing, buyerId, quantity);
      if (listingError) return ErrResult(listingError);

      const purchase = calculatePurchase(listing, quantity, config);
      const buyerBalance = activeWallets[buyerId]?.[config.currencyId] ?? 0;
      if (buyerBalance < purchase.total) {
        return ErrResult(
          new MarketDomainError(
            "INSUFFICIENT_FUNDS",
            `You need ${purchase.total} ${config.currencyId}`,
          ),
        );
      }
      if (activeFailCurrency.has(listing.sellerId) || activeFailInventory.has(buyerId)) {
        return ErrResult(new MarketDomainError("TRANSACTION_FAILED", "transaction aborted"));
      }

      activeWallets[buyerId] = {
        ...activeWallets[buyerId],
        [config.currencyId]: buyerBalance - purchase.total,
      };
      activeWallets[listing.sellerId] = {
        ...activeWallets[listing.sellerId],
        [config.currencyId]:
          (activeWallets[listing.sellerId]?.[config.currencyId] ?? 0) + purchase.sellerPayout,
      };
      activeInventories[buyerId] = {
        ...activeInventories[buyerId],
        [listing.itemId]: (activeInventories[buyerId]?.[listing.itemId] ?? 0) + quantity,
      };
      const listingPatch = purchaseListingPatch(listing, quantity);
      listingStore.set(listingId, { ...listing, ...listingPatch });

      return OkResult({
        listingId,
        itemId: listing.itemId,
        quantity,
        ...purchase,
        buyerNewBalance: activeWallets[buyerId]?.[config.currencyId] ?? 0,
        listingRemaining: listingPatch.quantity,
      });
    },
  );
  mockCancelListingTx.mockImplementation(
    async (
      _ctx: unknown,
      {
        actorId,
        listingId,
        allowModeratorOverride,
      }: {
        actorId: string;
        listingId: string;
        allowModeratorOverride?: boolean;
      },
    ) => {
      const listing = listingStore.get(listingId);
      if (!listing)
        return ErrResult(new MarketDomainError("LISTING_NOT_FOUND", "Listing not found"));
      const listingError = validateCancellableListing(listing, actorId, allowModeratorOverride);
      if (listingError) return ErrResult(listingError);
      if (activeFailInventory.has(listing.sellerId)) {
        return ErrResult(new MarketDomainError("TRANSACTION_FAILED", "transaction aborted"));
      }

      listingStore.set(listingId, { ...listing, ...cancelListingPatch(listing) });
      activeInventories[listing.sellerId] = {
        ...activeInventories[listing.sellerId],
        [listing.itemId]:
          (activeInventories[listing.sellerId]?.[listing.itemId] ?? 0) + listing.quantity,
      };
      return OkResult({
        listingId,
        itemId: listing.itemId,
        returnedQuantity: listing.quantity,
      });
    },
  );
  mockFindActiveMarketListings.mockImplementation(
    async (
      _ctx: unknown,
      guildId: string,
      options: { itemId?: string; sellerId?: string; limit?: number; skip?: number } = {},
    ) =>
      OkResult(
        Array.from(listingStore.values()).filter(
          (listing) =>
            listing.guildId === guildId &&
            listing.status === "active" &&
            (!options.itemId || listing.itemId === options.itemId) &&
            (!options.sellerId || listing.sellerId === options.sellerId),
        ),
      ),
  );
}

// ---------------------------------------------------------------------------
// createListing tests
// ---------------------------------------------------------------------------

describe("createListing", () => {
  beforeEach(resetAll);

  test("creates a listing successfully", async () => {
    const inventory = { "seller-1": { wood: 10 } };

    const result = await createListing(
      makeCtx({}, inventory),
      "seller-1",
      "guild-1",
      "wood",
      10,
      50,
    );

    expect(result.isOk()).toBe(true);
    const data = result.unwrap();
    expect(data.itemId).toBe("wood");
    expect(data.quantity).toBe(10);
    expect(data.pricePerUnit).toBe(50);
    expect(data.listingId).toMatch(/^listing:/);
    expect(inventory["seller-1"]?.wood).toBe(0);
    expect(mockSetCooldown).toHaveBeenCalledWith("seller-1", "market:create", 3_000);
  });

  test("rejects when seller lacks enough stackable inventory", async () => {
    const result = await createListing(
      makeCtx({}, { "seller-1": { wood: 4 } }),
      "seller-1",
      "guild-1",
      "wood",
      10,
      50,
    );

    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof MarketError>;
    expect(err.code).toBe("INSUFFICIENT_INVENTORY");
  });

  test("leaves seller inventory untouched if listing transaction aborts", async () => {
    const inventory = { "seller-1": { wood: 10 } };
    mockCreateListingTx.mockImplementation(async () =>
      ErrResult(new MarketDomainError("TRANSACTION_FAILED", "save failed")),
    );

    const result = await createListing(
      makeCtx({}, inventory),
      "seller-1",
      "guild-1",
      "wood",
      10,
      50,
    );

    expect(result.isErr()).toBe(true);
    expect(inventory["seller-1"]?.wood).toBe(10);
  });

  test("rejects invalid quantity", async () => {
    const result = await createListing(makeCtx(), "seller-1", "guild-1", "wood", 0, 50);
    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof MarketError>;
    expect(err).toBeInstanceOf(MarketError);
    expect(err.code).toBe("INVALID_QUANTITY");
  });

  test("rejects price below minimum", async () => {
    const result = await createListing(makeCtx(), "seller-1", "guild-1", "wood", 10, 0);
    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof MarketError>;
    expect(err.code).toBe("INVALID_PRICE");
  });

  test("rejects price above maximum", async () => {
    const result = await createListing(makeCtx(), "seller-1", "guild-1", "wood", 10, 2_000_000);
    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof MarketError>;
    expect(err.code).toBe("INVALID_PRICE");
  });

  test("rejects when on cooldown", async () => {
    mockIsOnCooldown.mockImplementation((_: string, key: string) => key === "market:create");
    mockGetRemainingMs.mockImplementation(() => 1_500);

    const result = await createListing(makeCtx(), "seller-1", "guild-1", "wood", 10, 50);
    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof MarketError>;
    expect(err.code).toBe("COOLDOWN_ACTIVE");
  });

  test("rejects when listing limit reached", async () => {
    for (let index = 0; index < 20; index += 1) {
      listingStore.set(`listing:${index}`, makeListing({ _id: `listing:${index}` }));
    }

    const result = await createListing(
      makeCtx({}, { "seller-1": { wood: 10 } }),
      "seller-1",
      "guild-1",
      "wood",
      10,
      50,
    );
    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof MarketError>;
    expect(err.code).toBe("LISTING_LIMIT_REACHED");
  });
});

// ---------------------------------------------------------------------------
// buyListing tests
// ---------------------------------------------------------------------------

describe("buyListing", () => {
  beforeEach(resetAll);

  test("buys successfully — partial quantity, transfers currency", async () => {
    listingStore.set("listing:test-1", makeListing());
    // buyer has 500 coins, cost = 5 * 10 * 1.02 = 51
    mockUserEnsure.mockImplementation(async () => OkResult(makeUser({ coins: 500 })));
    const wallets = { "buyer-1": { coins: 500 }, "seller-1": { coins: 0 } };
    const inventory: Record<string, Record<string, number>> = { "buyer-1": {} };

    const result = await buyListing(makeCtx(wallets, inventory), "buyer-1", "listing:test-1", 5);

    expect(result.isOk()).toBe(true);
    const data = result.unwrap();
    expect(data.itemId).toBe("wood");
    expect(data.quantity).toBe(5);
    expect(data.subtotal).toBe(50);
    expect(data.fee).toBe(1); // floor(50 * 0.02) = 1
    expect(data.total).toBe(51);
    expect(data.sellerPayout).toBe(50);
    expect(data.listingRemaining).toBe(45);
    // buyer: 500 - 51 = 449
    expect(data.buyerNewBalance).toBe(449);
    expect(wallets["seller-1"]?.coins).toBe(50);
    expect(inventory["buyer-1"]?.wood).toBe(5);
  });

  test("marks listing sold_out when buying all", async () => {
    listingStore.set("listing:test-1", makeListing({ quantity: 10 }));
    mockUserEnsure.mockImplementation(async () => OkResult(makeUser({ coins: 1000 })));

    const result = await buyListing(
      makeCtx({ "buyer-1": { coins: 1000 } }),
      "buyer-1",
      "listing:test-1",
      10,
    );

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().listingRemaining).toBe(0);
    const stored = listingStore.get("listing:test-1");
    expect(stored?.status).toBe("sold_out");
  });

  test("fails stale listing CAS and refunds buyer", async () => {
    listingStore.set("listing:test-1", makeListing());
    const wallets = { "buyer-1": { coins: 500 }, "seller-1": { coins: 0 } };
    mockBuyListingTx.mockImplementation(async () =>
      ErrResult(new MarketDomainError("TRANSACTION_FAILED", "listing changed")),
    );

    const result = await buyListing(makeCtx(wallets), "buyer-1", "listing:test-1", 5);

    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof MarketError>;
    expect(err.code).toBe("TRANSACTION_FAILED");
    expect(wallets["buyer-1"]?.coins).toBe(500);
    expect(wallets["seller-1"]?.coins).toBe(0);
  });

  test("rolls back buyer debit and listing update if seller credit fails", async () => {
    listingStore.set("listing:test-1", makeListing());
    const wallets = { "buyer-1": { coins: 500 }, "seller-1": { coins: 0 } };

    const result = await buyListing(
      makeCtx(wallets, {}, { failCurrencyPatchForUser: ["seller-1"] }),
      "buyer-1",
      "listing:test-1",
      5,
    );

    expect(result.isErr()).toBe(true);
    expect(wallets["buyer-1"]?.coins).toBe(500);
    expect(wallets["seller-1"]?.coins).toBe(0);
    expect(listingStore.get("listing:test-1")).toMatchObject({
      quantity: 50,
      status: "active",
      version: 0,
    });
  });

  test("only one simultaneous buyer can consume the final quantity", async () => {
    listingStore.set("listing:test-1", makeListing({ quantity: 5 }));
    const wallets = {
      "buyer-1": { coins: 500 },
      "buyer-2": { coins: 500 },
      "seller-1": { coins: 0 },
    };
    const inventory: Record<string, Record<string, number>> = { "buyer-1": {}, "buyer-2": {} };
    const ctx = makeCtx(wallets, inventory);

    const results = await Promise.all([
      buyListing(ctx, "buyer-1", "listing:test-1", 5),
      buyListing(ctx, "buyer-2", "listing:test-1", 5),
    ]);

    expect(results.filter((result) => result.isOk())).toHaveLength(1);
    expect(listingStore.get("listing:test-1")).toMatchObject({
      quantity: 0,
      status: "sold_out",
      version: 1,
    });
    expect((inventory["buyer-1"]?.wood ?? 0) + (inventory["buyer-2"]?.wood ?? 0)).toBe(5);
    expect(wallets["seller-1"]?.coins).toBe(50);
  });

  test("rejects self-buy", async () => {
    listingStore.set("listing:test-1", makeListing({ sellerId: "buyer-1" }));

    const result = await buyListing(makeCtx(), "buyer-1", "listing:test-1", 5);
    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof MarketError>;
    expect(err.code).toBe("SELF_BUY_FORBIDDEN");
  });

  test("rejects when listing not found", async () => {
    const result = await buyListing(makeCtx(), "buyer-1", "listing:nonexistent", 5);
    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof MarketError>;
    expect(err.code).toBe("LISTING_NOT_FOUND");
  });

  test("rejects when listing is not active", async () => {
    listingStore.set("listing:test-1", makeListing({ status: "sold_out" }));

    const result = await buyListing(makeCtx(), "buyer-1", "listing:test-1", 5);
    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof MarketError>;
    expect(err.code).toBe("LISTING_NOT_ACTIVE");
  });

  test("rejects when buying more than available", async () => {
    listingStore.set("listing:test-1", makeListing({ quantity: 3 }));

    const result = await buyListing(makeCtx(), "buyer-1", "listing:test-1", 5);
    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof MarketError>;
    expect(err.code).toBe("INSUFFICIENT_LISTING_QUANTITY");
  });

  test("rejects when buyer has insufficient funds", async () => {
    listingStore.set("listing:test-1", makeListing({ pricePerUnit: 100 }));
    // buyer only has 50 coins, total = 500 + fee
    mockUserGet.mockImplementation(async () => OkResult<User | null>(makeUser({ coins: 50 })));
    mockUserEnsure.mockImplementation(async () => OkResult(makeUser({ coins: 50 })));

    const result = await buyListing(
      makeCtx({ "buyer-1": { coins: 50 } }),
      "buyer-1",
      "listing:test-1",
      5,
    );
    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof MarketError>;
    expect(err.code).toBe("INSUFFICIENT_FUNDS");
  });

  test("rejects when on cooldown", async () => {
    mockIsOnCooldown.mockImplementation((_: string, key: string) => key === "market:buy");
    mockGetRemainingMs.mockImplementation(() => 1_000);

    const result = await buyListing(makeCtx(), "buyer-1", "listing:test-1", 5);
    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof MarketError>;
    expect(err.code).toBe("COOLDOWN_ACTIVE");
  });
});

// ---------------------------------------------------------------------------
// cancelListing tests
// ---------------------------------------------------------------------------

describe("cancelListing", () => {
  beforeEach(resetAll);

  test("seller can cancel own active listing", async () => {
    listingStore.set("listing:test-1", makeListing());
    const inventory: Record<string, Record<string, number>> = { "seller-1": {} };

    const result = await cancelListing(makeCtx({}, inventory), "seller-1", "listing:test-1");

    expect(result.isOk()).toBe(true);
    const data = result.unwrap();
    expect(data.listingId).toBe("listing:test-1");
    expect(data.itemId).toBe("wood");
    expect(data.returnedQuantity).toBe(50);
    const stored = listingStore.get("listing:test-1");
    expect(stored?.status).toBe("cancelled");
    expect(inventory["seller-1"]?.wood).toBe(50);
  });

  test("fails stale cancel CAS", async () => {
    listingStore.set("listing:test-1", makeListing());
    mockCancelListingTx.mockImplementation(async () =>
      ErrResult(new MarketDomainError("TRANSACTION_FAILED", "listing changed")),
    );

    const result = await cancelListing(makeCtx(), "seller-1", "listing:test-1");

    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof MarketError>;
    expect(err.code).toBe("TRANSACTION_FAILED");
    expect(listingStore.get("listing:test-1")?.status).toBe("active");
  });

  test("moderator can cancel with allowModeratorOverride", async () => {
    listingStore.set("listing:test-1", makeListing({ sellerId: "seller-1" }));

    const result = await cancelListing(makeCtx(), "mod-1", "listing:test-1", {
      allowModeratorOverride: true,
    });
    expect(result.isOk()).toBe(true);
  });

  test("non-owner without override gets PERMISSION_DENIED", async () => {
    listingStore.set("listing:test-1", makeListing({ sellerId: "seller-1" }));

    const result = await cancelListing(makeCtx(), "other-user", "listing:test-1");
    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof MarketError>;
    expect(err.code).toBe("PERMISSION_DENIED");
  });

  test("cancelling already-cancelled listing returns LISTING_NOT_ACTIVE", async () => {
    listingStore.set("listing:test-1", makeListing({ status: "cancelled" }));

    const result = await cancelListing(makeCtx(), "seller-1", "listing:test-1");
    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof MarketError>;
    expect(err.code).toBe("LISTING_NOT_ACTIVE");
  });

  test("returns LISTING_NOT_FOUND for unknown listing", async () => {
    const result = await cancelListing(makeCtx(), "seller-1", "listing:nonexistent");
    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof MarketError>;
    expect(err.code).toBe("LISTING_NOT_FOUND");
  });
});

// ---------------------------------------------------------------------------
// browseListings tests
// ---------------------------------------------------------------------------

describe("browseListings", () => {
  beforeEach(resetAll);

  test("returns active listings for guild", async () => {
    const listing1 = makeListing({ _id: "listing:1", itemId: "wood", pricePerUnit: 5 });
    const listing2 = makeListing({ _id: "listing:2", itemId: "stone", pricePerUnit: 8 });
    listingStore.set(listing1._id, listing1);
    listingStore.set(listing2._id, listing2);

    const result = await browseListings(makeCtx(), "guild-1");

    expect(result.isOk()).toBe(true);
    const data = result.unwrap();
    expect(data.listings).toHaveLength(2);
    expect(data.page).toBe(0);
    expect(data.pageSize).toBe(10);
  });

  test("passes itemId filter to repository", async () => {
    const result = await browseListings(makeCtx(), "guild-1", { itemId: "wood" });

    expect(result.isOk()).toBe(true);
    expect(mockFindActiveMarketListings).toHaveBeenCalledWith(
      expect.anything(),
      "guild-1",
      expect.objectContaining({ itemId: "wood" }),
    );
  });

  test("supports pagination via page and pageSize", async () => {
    const result = await browseListings(makeCtx(), "guild-1", { page: 2, pageSize: 5 });

    expect(result.isOk()).toBe(true);
    const data = result.unwrap();
    expect(data.page).toBe(2);
    expect(data.pageSize).toBe(5);
    expect(mockFindActiveMarketListings).toHaveBeenCalledWith(
      expect.anything(),
      "guild-1",
      expect.objectContaining({ skip: 10, limit: 5 }),
    );
  });
});
