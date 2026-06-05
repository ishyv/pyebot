import { beforeEach, describe, expect, mock, test } from "bun:test";
import { EconomyAccount, UserCurrency } from "@/components/economy/wallet";
import { UserInventory } from "@/components/rpg/inventory";
import type { MarketListingDoc } from "@/db/schemas/market";
import type { MarketConfig } from "./market-types";

const NOW = new Date("2026-01-01T00:00:00.000Z");

type Doc = Record<string, unknown> & { _id: string };

const state = {
  supportsTransactions: true,
  failSellerCredit: false,
  failBuyerInventory: false,
  failCancelReturn: false,
  listings: new Map<string, MarketListingDoc>(),
  users: new Map<string, Doc>(),
};

function cloneMap<T>(source: Map<string, T>): Map<string, T> {
  return new Map(Array.from(source, ([key, value]) => [key, structuredClone(value)]));
}

function resetState() {
  state.supportsTransactions = true;
  state.failSellerCredit = false;
  state.failBuyerInventory = false;
  state.failCancelReturn = false;
  state.listings.clear();
  state.users.clear();
}

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

function getByPath(doc: Doc, path: string): unknown {
  return path.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[part];
  }, doc);
}

function setByPath(doc: Doc, path: string, value: unknown) {
  const parts = path.split(".");
  let current: Record<string, unknown> = doc;
  for (const part of parts.slice(0, -1)) {
    const next = current[part];
    if (!next || typeof next !== "object") current[part] = {};
    current = current[part] as Record<string, unknown>;
  }
  current[parts.at(-1) ?? ""] = value;
}

function matches(doc: Doc, filter: Record<string, unknown>): boolean {
  return Object.entries(filter).every(([key, expected]) => {
    const actual = getByPath(doc, key);
    if (expected && typeof expected === "object" && "$gte" in expected) {
      return typeof actual === "number" && actual >= Number(expected.$gte);
    }
    return actual === expected;
  });
}

function applyUpdate(doc: Doc, update: Record<string, unknown>) {
  for (const [path, value] of Object.entries((update.$set ?? {}) as Record<string, unknown>)) {
    setByPath(doc, path, value);
  }
  for (const [path, value] of Object.entries((update.$inc ?? {}) as Record<string, number>)) {
    const current = getByPath(doc, path);
    if (current !== undefined && typeof current !== "number") {
      throw new Error(`Cannot increment non-number path ${path}`);
    }
    setByPath(doc, path, (current ?? 0) + value);
  }
}

class FakeCollection<T extends Doc> {
  constructor(private readonly docs: Map<string, T>) {}

  async findOne(filter: Record<string, unknown>) {
    return Array.from(this.docs.values()).find((doc) => matches(doc, filter)) ?? null;
  }

  async insertOne(doc: T) {
    this.docs.set(doc._id, structuredClone(doc));
    return { acknowledged: true };
  }

  async countDocuments(filter: Record<string, unknown>) {
    return Array.from(this.docs.values()).filter((doc) => matches(doc, filter)).length;
  }

  async updateOne(
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options: { upsert?: boolean } = {},
  ) {
    const existing = Array.from(this.docs.values()).find((doc) => matches(doc, filter));
    if (!existing && !options.upsert) return { matchedCount: 0, modifiedCount: 0 };

    const doc =
      existing ??
      ({
        _id: String(filter._id),
        ...((update.$setOnInsert ?? {}) as Record<string, unknown>),
      } as T);

    applyUpdate(doc, update);
    this.docs.set(doc._id, doc);
    return { matchedCount: existing ? 1 : 0, modifiedCount: 1 };
  }

  find(filter: Record<string, unknown>) {
    const docs = Array.from(this.docs.values()).filter((doc) => matches(doc, filter));
    return {
      sort: () => ({
        skip: (count: number) => ({
          limit: (limit: number) => ({ toArray: async () => docs.slice(count, count + limit) }),
          toArray: async () => docs.slice(count),
        }),
        limit: (limit: number) => ({ toArray: async () => docs.slice(0, limit) }),
        toArray: async () => docs,
      }),
    };
  }

  async findOneAndUpdate(
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options: { upsert?: boolean; returnDocument?: "after" } = {},
  ) {
    const inc = (update.$inc ?? {}) as Record<string, number>;
    if (
      this.docs === state.users &&
      filter._id === "seller-1" &&
      state.failSellerCredit &&
      Object.keys(inc).some((path) => path.startsWith(`${UserCurrency.name}.balances.`))
    ) {
      throw new Error("seller credit failed");
    }
    if (
      this.docs === state.users &&
      filter._id === "buyer-1" &&
      state.failBuyerInventory &&
      Object.keys(inc).some((path) => path.startsWith(`${UserInventory.name}.slots.`))
    ) {
      throw new Error("buyer inventory failed");
    }
    if (
      this.docs === state.users &&
      filter._id === "seller-1" &&
      state.failCancelReturn &&
      Object.keys(inc).some((path) => path.startsWith(`${UserInventory.name}.slots.`))
    ) {
      throw new Error("cancel return failed");
    }

    const existing = Array.from(this.docs.values()).find((doc) => matches(doc, filter));
    if (!existing && !options.upsert) return null;

    const doc =
      existing ??
      ({
        _id: String(filter._id),
        ...((update.$setOnInsert ?? {}) as Record<string, unknown>),
      } as T);

    applyUpdate(doc, update);
    this.docs.set(doc._id, doc);
    return structuredClone(doc);
  }
}

const fakeDb = {
  collection(name: string) {
    if (name === "marketListings") return new FakeCollection(state.listings as Map<string, Doc>);
    if (name === "users") return new FakeCollection(state.users);
    throw new Error(`unexpected collection ${name}`);
  },
};

mock.module("@/core/db", () => ({
  getDb: async () => fakeDb,
  getMongoClient: async () => ({
    startSession: () => ({
      async withTransaction(fn: () => Promise<void>) {
        if (!state.supportsTransactions) {
          throw new Error("Transaction numbers are only allowed on a replica set member or mongos");
        }
        const before = {
          listings: cloneMap(state.listings),
          users: cloneMap(state.users),
        };
        try {
          await fn();
        } catch (error) {
          state.listings = before.listings;
          state.users = before.users;
          throw error;
        }
      },
      async endSession() {},
    }),
  }),
}));

const { buyListingTx, cancelListingTx, createListingTx, MarketPersistenceError } = await import(
  "./market-persistence"
);

const cfg: MarketConfig = {
  maxActiveListings: 20,
  createCooldownMs: 3_000,
  buyCooldownMs: 2_000,
  feeRate: 0.02,
  minPrice: 1,
  maxPrice: 1_000_000,
  pageSize: 10,
  currencyId: "coins",
};

describe("market transaction persistence", () => {
  beforeEach(resetState);

  test("createListingTx commits inventory escrow and listing together", async () => {
    state.users.set("seller-1", {
      _id: "seller-1",
      [UserInventory.name]: { slots: { wood: { qty: 10 } } },
    });

    const result = await createListingTx({ listing: makeListing({ quantity: 4 }), config: cfg });

    expect(result.isOk()).toBe(true);
    expect(state.users.get("seller-1")?.[UserInventory.name]).toEqual({
      slots: { wood: { qty: 6 } },
    });
    expect(state.listings.get("listing:test-1")?.quantity).toBe(4);
    expect((state.users.get("seller-1")?.[EconomyAccount.name] as { status?: string }).status).toBe(
      "ok",
    );
  });

  test("buyListingTx aborts all writes when seller credit fails", async () => {
    state.failSellerCredit = true;
    state.listings.set("listing:test-1", makeListing());
    state.users.set("buyer-1", {
      _id: "buyer-1",
      [UserCurrency.name]: { balances: { coins: 500 } },
    });

    const result = await buyListingTx({
      listingId: "listing:test-1",
      buyerId: "buyer-1",
      quantity: 5,
      config: cfg,
    });

    expect(result.isErr()).toBe(true);
    expect(
      (state.users.get("buyer-1")?.[UserCurrency.name] as { balances?: unknown }).balances,
    ).toEqual({ coins: 500 });
    expect(state.users.get("seller-1")).toBeUndefined();
    expect((state.users.get("buyer-1")?.[UserInventory.name] as unknown) ?? null).toBeNull();
    expect(state.listings.get("listing:test-1")).toMatchObject({ quantity: 50, version: 0 });
  });

  test("buyListingTx aborts all writes when buyer inventory grant fails", async () => {
    state.failBuyerInventory = true;
    state.listings.set("listing:test-1", makeListing());
    state.users.set("buyer-1", {
      _id: "buyer-1",
      [UserCurrency.name]: { balances: { coins: 500 } },
    });

    const result = await buyListingTx({
      listingId: "listing:test-1",
      buyerId: "buyer-1",
      quantity: 5,
      config: cfg,
    });

    expect(result.isErr()).toBe(true);
    expect(
      (state.users.get("buyer-1")?.[UserCurrency.name] as { balances?: unknown }).balances,
    ).toEqual({ coins: 500 });
    expect(state.users.get("seller-1")).toBeUndefined();
    expect((state.users.get("buyer-1")?.[UserInventory.name] as unknown) ?? null).toBeNull();
    expect(state.listings.get("listing:test-1")).toMatchObject({ quantity: 50, version: 0 });
  });

  test("cancelListingTx aborts listing cancellation when inventory return fails", async () => {
    state.failCancelReturn = true;
    state.listings.set("listing:test-1", makeListing());

    const result = await cancelListingTx({ listingId: "listing:test-1", actorId: "seller-1" });

    expect(result.isErr()).toBe(true);
    expect(state.users.get("seller-1")).toBeUndefined();
    expect(state.listings.get("listing:test-1")).toMatchObject({ status: "active", version: 0 });
  });

  test("returns TRANSACTION_UNSUPPORTED without mutating state when Mongo cannot transact", async () => {
    state.supportsTransactions = false;
    state.users.set("seller-1", {
      _id: "seller-1",
      [UserInventory.name]: { slots: { wood: { qty: 10 } } },
    });

    const result = await createListingTx({ listing: makeListing({ quantity: 4 }), config: cfg });

    expect(result.isErr()).toBe(true);
    expect(result.error).toBeInstanceOf(MarketPersistenceError);
    expect(result.error.code).toBe("TRANSACTION_UNSUPPORTED");
    expect(state.users.get("seller-1")?.[UserInventory.name]).toEqual({
      slots: { wood: { qty: 10 } },
    });
    expect(state.listings.size).toBe(0);
  });
});
