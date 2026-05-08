/**
 * Tests for economy marketplace (createListing, buyListing, cancelListing, browseListings).
 * Mocks state, account, userStore, and economy repo — no real DB required.
 *
 * NOTE: We mock @/db/repositories/users and @/db/repositories/economy (not service layers)
 * to avoid Bun module mock cross-contamination with mutations.test.ts and minigames.test.ts.
 */

import { describe, expect, test, mock, beforeEach } from "bun:test";
import { OkResult } from "@/core/result";
import type { User } from "@/db/schemas/user";
import type { MarketListingDoc } from "@/db/schemas/market";

// ---------------------------------------------------------------------------
// Mock @/core/state BEFORE importing market
// ---------------------------------------------------------------------------

const mockIsOnCooldown = mock((_userId: string, _key: string) => false);
const mockGetRemainingMs = mock((_userId: string, _key: string) => 0);
const mockSetCooldown = mock((_userId: string, _key: string, _ms: number) => {});

mock.module("@/core/state", () => ({
  cooldowns: {
    isOnCooldown: mockIsOnCooldown,
    getRemainingMs: mockGetRemainingMs,
    set: mockSetCooldown,
  },
  sessions: { get: mock(() => undefined), set: mock(() => {}), delete: mock(() => {}), has: mock(() => false) },
}));

// ---------------------------------------------------------------------------
// Mock @/features/economy/account BEFORE importing market
// ---------------------------------------------------------------------------

const NOW = new Date("2026-01-01T00:00:00.000Z");

function makeAccountResult(userId: string, status: "ok" | "blocked" | "banned" = "ok") {
  return OkResult({
    account: { userId, status, createdAt: NOW, updatedAt: NOW, lastActivityAt: NOW, version: 0, dailyStreak: 0, lastDailyAt: null },
    isNew: false,
  });
}

const mockEnsureAccount = mock(async (userId: string) => makeAccountResult(userId));
const mockIsAccountActive = mock((status: string) => status === "ok");

mock.module("@/features/economy/account", () => ({
  ensureAccount: mockEnsureAccount,
  isAccountActive: mockIsAccountActive,
}));

// ---------------------------------------------------------------------------
// Mock @/db/repositories/users BEFORE importing market
// (mutations.ts uses userStore directly)
// ---------------------------------------------------------------------------

function makeUser(currency: Record<string, number> = { coins: 500 }): User {
  return {
    _id: "user-1",
    warns: [],
    sanction_history: {},
    openTickets: [],
    currency,
    mod_notes: {},
    quarantine_roles: {},
    economyAccount: undefined,
    rpgProfile: undefined,
    inventory: {},
  };
}

const mockUserGet = mock(async (_id: string) => OkResult<User | null>(makeUser()));
const mockUserEnsure = mock(async (_id: string) => OkResult(makeUser()));
const mockUserUpdatePaths = mock(async (_id: string, _paths: Record<string, unknown>) => OkResult(undefined as void));

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
  async (id: string, _expected: Partial<MarketListingDoc>, next: Partial<MarketListingDoc>) => {
    const existing = listingStore.get(id);
    if (!existing) return OkResult<MarketListingDoc | null>(null);
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
    collection: mock(async () => { throw new Error("collection() not mocked"); }),
  },
  findActiveListings: mockFindActiveListings,
  countActiveListings: mockCountActiveListings,
  // achievement store stubs (not used in market tests)
  achievementProgressStore: { get: mock(async () => OkResult(null)), set: mock(async () => OkResult(null)) },
  achievementUnlocksStore: { get: mock(async () => OkResult(null)), set: mock(async () => OkResult(null)) },
  getUnlocksForUser: mock(async () => OkResult([])),
  getProgressForUser: mock(async () => OkResult([])),
  // quest store stubs (not used in market tests)
  questProgressStore: { get: mock(async () => OkResult(null)), set: mock(async () => OkResult(null)) },
  getActiveQuestsForUser: mock(async () => OkResult([])),
}));

// ---------------------------------------------------------------------------
// Import AFTER mocking
// ---------------------------------------------------------------------------

const { createListing, buyListing, cancelListing, browseListings, MarketError } =
  await import("./market");

// ---------------------------------------------------------------------------
// Reset helpers
// ---------------------------------------------------------------------------

function resetAll() {
  mockIsOnCooldown.mockReset();
  mockGetRemainingMs.mockReset();
  mockSetCooldown.mockReset();
  mockEnsureAccount.mockReset();
  mockIsAccountActive.mockReset();
  mockUserGet.mockReset();
  mockUserEnsure.mockReset();
  mockUserUpdatePaths.mockReset();
  mockMarketGet.mockReset();
  mockMarketSet.mockReset();
  mockMarketReplaceIfMatch.mockReset();
  mockFindActiveListings.mockReset();
  mockCountActiveListings.mockReset();
  listingStore.clear();

  // Restore defaults
  mockIsOnCooldown.mockImplementation(() => false);
  mockGetRemainingMs.mockImplementation(() => 0);
  mockSetCooldown.mockImplementation(() => {});
  mockEnsureAccount.mockImplementation(async (userId: string) => makeAccountResult(userId));
  mockIsAccountActive.mockImplementation((status: string) => status === "ok");
  mockUserGet.mockImplementation(async () => OkResult<User | null>(makeUser()));
  mockUserEnsure.mockImplementation(async () => OkResult(makeUser()));
  mockUserUpdatePaths.mockImplementation(async () => OkResult(undefined as void));
  mockMarketGet.mockImplementation(async (id: string) => {
    const doc = listingStore.get(id);
    return OkResult<MarketListingDoc | null>(doc ?? null);
  });
  mockMarketSet.mockImplementation(async (_id: string, doc: MarketListingDoc) => {
    listingStore.set(doc._id, doc);
    return OkResult(doc);
  });
  mockMarketReplaceIfMatch.mockImplementation(
    async (id: string, _expected: Partial<MarketListingDoc>, next: Partial<MarketListingDoc>) => {
      const existing = listingStore.get(id);
      if (!existing) return OkResult<MarketListingDoc | null>(null);
      const updated = { ...existing, ...next };
      listingStore.set(id, updated);
      return OkResult<MarketListingDoc | null>(updated);
    },
  );
  mockFindActiveListings.mockImplementation(async (_guildId: string) =>
    OkResult(Array.from(listingStore.values()).filter((l) => l.status === "active")),
  );
  mockCountActiveListings.mockImplementation(async () => OkResult(0));
}

// ---------------------------------------------------------------------------
// createListing tests
// ---------------------------------------------------------------------------

describe("createListing", () => {
  beforeEach(resetAll);

  test("creates a listing successfully", async () => {
    const result = await createListing("seller-1", "guild-1", "wood", 10, 50);

    expect(result.isOk()).toBe(true);
    const data = result.unwrap();
    expect(data.itemId).toBe("wood");
    expect(data.quantity).toBe(10);
    expect(data.pricePerUnit).toBe(50);
    expect(data.listingId).toMatch(/^listing:/);
    expect(mockSetCooldown).toHaveBeenCalledWith("seller-1", "market:create", 3_000);
  });

  test("rejects invalid quantity", async () => {
    const result = await createListing("seller-1", "guild-1", "wood", 0, 50);
    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof MarketError>;
    expect(err).toBeInstanceOf(MarketError);
    expect(err.code).toBe("INVALID_QUANTITY");
  });

  test("rejects price below minimum", async () => {
    const result = await createListing("seller-1", "guild-1", "wood", 10, 0);
    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof MarketError>;
    expect(err.code).toBe("INVALID_PRICE");
  });

  test("rejects price above maximum", async () => {
    const result = await createListing("seller-1", "guild-1", "wood", 10, 2_000_000);
    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof MarketError>;
    expect(err.code).toBe("INVALID_PRICE");
  });

  test("rejects when on cooldown", async () => {
    mockIsOnCooldown.mockImplementation((_: string, key: string) => key === "market:create");
    mockGetRemainingMs.mockImplementation(() => 1_500);

    const result = await createListing("seller-1", "guild-1", "wood", 10, 50);
    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof MarketError>;
    expect(err.code).toBe("COOLDOWN_ACTIVE");
  });

  test("rejects when listing limit reached", async () => {
    mockCountActiveListings.mockImplementation(async () => OkResult(20));

    const result = await createListing("seller-1", "guild-1", "wood", 10, 50);
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

    const result = await buyListing("buyer-1", "listing:test-1", 5);

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
  });

  test("marks listing sold_out when buying all", async () => {
    listingStore.set("listing:test-1", makeListing({ quantity: 10 }));
    mockUserEnsure.mockImplementation(async () => OkResult(makeUser({ coins: 1000 })));

    const result = await buyListing("buyer-1", "listing:test-1", 10);

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().listingRemaining).toBe(0);
    const stored = listingStore.get("listing:test-1");
    expect(stored?.status).toBe("sold_out");
  });

  test("rejects self-buy", async () => {
    listingStore.set("listing:test-1", makeListing({ sellerId: "buyer-1" }));

    const result = await buyListing("buyer-1", "listing:test-1", 5);
    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof MarketError>;
    expect(err.code).toBe("SELF_BUY_FORBIDDEN");
  });

  test("rejects when listing not found", async () => {
    const result = await buyListing("buyer-1", "listing:nonexistent", 5);
    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof MarketError>;
    expect(err.code).toBe("LISTING_NOT_FOUND");
  });

  test("rejects when listing is not active", async () => {
    listingStore.set("listing:test-1", makeListing({ status: "sold_out" }));

    const result = await buyListing("buyer-1", "listing:test-1", 5);
    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof MarketError>;
    expect(err.code).toBe("LISTING_NOT_ACTIVE");
  });

  test("rejects when buying more than available", async () => {
    listingStore.set("listing:test-1", makeListing({ quantity: 3 }));

    const result = await buyListing("buyer-1", "listing:test-1", 5);
    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof MarketError>;
    expect(err.code).toBe("INSUFFICIENT_LISTING_QUANTITY");
  });

  test("rejects when buyer has insufficient funds", async () => {
    listingStore.set("listing:test-1", makeListing({ pricePerUnit: 100 }));
    // buyer only has 50 coins, total = 500 + fee
    mockUserGet.mockImplementation(async () => OkResult<User | null>(makeUser({ coins: 50 })));
    mockUserEnsure.mockImplementation(async () => OkResult(makeUser({ coins: 50 })));

    const result = await buyListing("buyer-1", "listing:test-1", 5);
    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof MarketError>;
    expect(err.code).toBe("INSUFFICIENT_FUNDS");
  });

  test("rejects when on cooldown", async () => {
    mockIsOnCooldown.mockImplementation((_: string, key: string) => key === "market:buy");
    mockGetRemainingMs.mockImplementation(() => 1_000);

    const result = await buyListing("buyer-1", "listing:test-1", 5);
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

    const result = await cancelListing("seller-1", "listing:test-1");

    expect(result.isOk()).toBe(true);
    const data = result.unwrap();
    expect(data.listingId).toBe("listing:test-1");
    expect(data.itemId).toBe("wood");
    expect(data.returnedQuantity).toBe(50);
    const stored = listingStore.get("listing:test-1");
    expect(stored?.status).toBe("cancelled");
  });

  test("moderator can cancel with allowModeratorOverride", async () => {
    listingStore.set("listing:test-1", makeListing({ sellerId: "seller-1" }));

    const result = await cancelListing("mod-1", "listing:test-1", { allowModeratorOverride: true });
    expect(result.isOk()).toBe(true);
  });

  test("non-owner without override gets PERMISSION_DENIED", async () => {
    listingStore.set("listing:test-1", makeListing({ sellerId: "seller-1" }));

    const result = await cancelListing("other-user", "listing:test-1");
    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof MarketError>;
    expect(err.code).toBe("PERMISSION_DENIED");
  });

  test("cancelling already-cancelled listing returns LISTING_NOT_ACTIVE", async () => {
    listingStore.set("listing:test-1", makeListing({ status: "cancelled" }));

    const result = await cancelListing("seller-1", "listing:test-1");
    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof MarketError>;
    expect(err.code).toBe("LISTING_NOT_ACTIVE");
  });

  test("returns LISTING_NOT_FOUND for unknown listing", async () => {
    const result = await cancelListing("seller-1", "listing:nonexistent");
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

    const result = await browseListings("guild-1");

    expect(result.isOk()).toBe(true);
    const data = result.unwrap();
    expect(data.listings).toHaveLength(2);
    expect(data.page).toBe(0);
    expect(data.pageSize).toBe(10);
  });

  test("passes itemId filter to repository", async () => {
    const result = await browseListings("guild-1", { itemId: "wood" });

    expect(result.isOk()).toBe(true);
    expect(mockFindActiveListings).toHaveBeenCalledWith("guild-1", expect.objectContaining({ itemId: "wood" }));
  });

  test("supports pagination via page and pageSize", async () => {
    const result = await browseListings("guild-1", { page: 2, pageSize: 5 });

    expect(result.isOk()).toBe(true);
    const data = result.unwrap();
    expect(data.page).toBe(2);
    expect(data.pageSize).toBe(5);
    expect(mockFindActiveListings).toHaveBeenCalledWith("guild-1", expect.objectContaining({ skip: 10, limit: 5 }));
  });
});
