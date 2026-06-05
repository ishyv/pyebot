import { beforeEach, describe, expect, test } from "bun:test";
import {
  type MarketListingDoc,
  MarketListingRecord,
  type MarketListingValue,
} from "@/components/economy/market-listing";
import { EconomyAccount, UserCurrency, type UserCurrencyValue } from "@/components/economy/wallet";
import { MarketListing as MarketListingKind, User } from "@/components/entities";
import { UserInventory, type UserInventoryValue } from "@/components/rpg/inventory";
import type { EntityComponent, EntityKind } from "@/framework";
import { selectorPath } from "@/framework/entity-store";
import type { Ctx, Entity, Transaction } from "@/framework/types";
import type { MarketConfig } from "./market-types";

const NOW = new Date("2026-01-01T00:00:00.000Z");

type EntityDoc = { _id: string } & Record<string, unknown>;

const state = {
  supportsTransactions: true,
  failSellerCredit: false,
  failBuyerInventory: false,
  failCancelReturn: false,
  users: new Map<string, EntityDoc>(),
  marketListings: new Map<string, EntityDoc>(),
};

function cloneMap(source: Map<string, EntityDoc>): Map<string, EntityDoc> {
  return new Map(Array.from(source, ([key, value]) => [key, structuredClone(value)]));
}

function resetState() {
  state.supportsTransactions = true;
  state.failSellerCredit = false;
  state.failBuyerInventory = false;
  state.failCancelReturn = false;
  state.users.clear();
  state.marketListings.clear();
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

function getByPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[part];
  }, value);
}

function collection(kind: EntityKind): Map<string, EntityDoc> {
  if (kind.collection === User.collection) return state.users;
  if (kind.collection === MarketListingKind.collection) return state.marketListings;
  throw new Error(`unexpected entity kind ${kind.collection}`);
}

function shouldFailUpdate<T>(
  id: string,
  component: EntityComponent<T>,
  current: T,
  next: T,
): boolean {
  const stackQty = (inventory: UserInventoryValue) => {
    const slot = inventory.slots.wood;
    return slot && "qty" in slot ? slot.qty : 0;
  };
  if (component === UserCurrency && id === "seller-1" && state.failSellerCredit) {
    const before = (current as UserCurrencyValue).balances.coins ?? 0;
    const after = (next as UserCurrencyValue).balances.coins ?? 0;
    return after > before;
  }
  if (component === UserInventory && id === "buyer-1" && state.failBuyerInventory) {
    const before = stackQty(current as UserInventoryValue);
    const after = stackQty(next as UserInventoryValue);
    return after > before;
  }
  if (component === UserInventory && id === "seller-1" && state.failCancelReturn) {
    const before = stackQty(current as UserInventoryValue);
    const after = stackQty(next as UserInventoryValue);
    return after > before;
  }
  return false;
}

function handle(kind: EntityKind, id: Entity) {
  return {
    async get<T>(component: EntityComponent<T>): Promise<T> {
      const doc = collection(kind).get(id);
      return component.schema.parse(doc?.[component.name] ?? {});
    },
    async peek<T>(component: EntityComponent<T>): Promise<T | null> {
      const doc = collection(kind).get(id);
      if (!doc || !(component.name in doc)) return null;
      return component.schema.parse(doc[component.name]);
    },
    async has<T>(component: EntityComponent<T>): Promise<boolean> {
      const doc = collection(kind).get(id);
      return Boolean(doc && component.name in doc);
    },
    async set<T>(component: EntityComponent<T>, value: T): Promise<void> {
      const docs = collection(kind);
      const doc = docs.get(id) ?? { _id: id };
      doc[component.name] = structuredClone(value);
      docs.set(id, doc);
    },
    async update<T>(
      component: EntityComponent<T>,
      patch: Partial<T> | ((current: T) => Partial<T>),
    ): Promise<void> {
      const current = await this.get(component);
      const partial = typeof patch === "function" ? patch(current) : patch;
      const next = { ...(current as object), ...(partial as object) } as T;
      if (shouldFailUpdate(id, component, current, next)) throw new Error("injected write failure");
      await this.set(component, next);
    },
  };
}

function query<T>(component: EntityComponent<T>) {
  const filters: Array<{ path: string; value: unknown }> = [];
  const sorts: Array<{ path: string; direction: 1 | -1 }> = [];
  let limitN: number | undefined;
  let skipN = 0;
  const api = {
    whereEq(selector: (value: T) => unknown, value: unknown) {
      filters.push({ path: selectorPath(selector), value });
      return api;
    },
    sortAsc(selector: (value: T) => unknown) {
      sorts.length = 0;
      sorts.push({ path: selectorPath(selector), direction: 1 });
      return api;
    },
    sortDesc(selector: (value: T) => unknown) {
      sorts.length = 0;
      sorts.push({ path: selectorPath(selector), direction: -1 });
      return api;
    },
    thenAsc(selector: (value: T) => unknown) {
      sorts.push({ path: selectorPath(selector), direction: 1 });
      return api;
    },
    thenDesc(selector: (value: T) => unknown) {
      sorts.push({ path: selectorPath(selector), direction: -1 });
      return api;
    },
    limit(n: number) {
      limitN = n;
      return api;
    },
    skip(n: number) {
      skipN = n;
      return api;
    },
    async run() {
      const rows = Array.from(collection(component.kind).values())
        .filter((doc) => component.name in doc)
        .map((doc) => ({ id: doc._id, value: component.schema.parse(doc[component.name]) as T }))
        .filter((row) =>
          filters.every((filter) => getByPath(row.value, filter.path) === filter.value),
        )
        .sort((a, b) => {
          for (const sort of sorts) {
            const av = getByPath(a.value, sort.path);
            const bv = getByPath(b.value, sort.path);
            if (av === bv) continue;
            return (av && bv && av > bv ? 1 : -1) * sort.direction;
          }
          return 0;
        });
      return rows.slice(skipN, limitN === undefined ? undefined : skipN + limitN);
    },
  };
  return api;
}

const fakeCtx = {
  of: handle,
  select: query,
  async transaction<R>(fn: (tx: Transaction) => Promise<R>): Promise<R> {
    if (!state.supportsTransactions) {
      throw new Error("Transaction numbers are only allowed on a replica set member or mongos");
    }
    const before = {
      users: cloneMap(state.users),
      marketListings: cloneMap(state.marketListings),
    };
    try {
      return await fn({ of: handle, select: query } as unknown as Transaction);
    } catch (error) {
      state.users = before.users;
      state.marketListings = before.marketListings;
      throw error;
    }
  },
} as unknown as Ctx;

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

    const result = await createListingTx(fakeCtx, {
      listing: makeListing({ quantity: 4 }),
      config: cfg,
    });

    expect(result.isOk()).toBe(true);
    expect(state.users.get("seller-1")?.[UserInventory.name]).toEqual({
      slots: { wood: { qty: 6 } },
    });
    expect(state.marketListings.get("listing:test-1")?.[MarketListingRecord.name]).toMatchObject({
      quantity: 4,
      status: "active",
    });
    expect((state.users.get("seller-1")?.[EconomyAccount.name] as { status?: string }).status).toBe(
      "ok",
    );
  });

  test("buyListingTx aborts all writes when seller credit fails", async () => {
    state.failSellerCredit = true;
    state.marketListings.set("listing:test-1", {
      _id: "listing:test-1",
      [MarketListingRecord.name]: listingValue(makeListing()),
    });
    state.users.set("buyer-1", {
      _id: "buyer-1",
      [UserCurrency.name]: { balances: { coins: 500 } },
    });

    const result = await buyListingTx(fakeCtx, {
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
    expect(state.marketListings.get("listing:test-1")?.[MarketListingRecord.name]).toMatchObject({
      quantity: 50,
      version: 0,
    });
  });

  test("buyListingTx aborts all writes when buyer inventory grant fails", async () => {
    state.failBuyerInventory = true;
    state.marketListings.set("listing:test-1", {
      _id: "listing:test-1",
      [MarketListingRecord.name]: listingValue(makeListing()),
    });
    state.users.set("buyer-1", {
      _id: "buyer-1",
      [UserCurrency.name]: { balances: { coins: 500 } },
    });

    const result = await buyListingTx(fakeCtx, {
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
    expect(state.marketListings.get("listing:test-1")?.[MarketListingRecord.name]).toMatchObject({
      quantity: 50,
      version: 0,
    });
  });

  test("cancelListingTx aborts listing cancellation when inventory return fails", async () => {
    state.failCancelReturn = true;
    state.marketListings.set("listing:test-1", {
      _id: "listing:test-1",
      [MarketListingRecord.name]: listingValue(makeListing()),
    });

    const result = await cancelListingTx(fakeCtx, {
      listingId: "listing:test-1",
      actorId: "seller-1",
    });

    expect(result.isErr()).toBe(true);
    expect(state.users.get("seller-1")).toBeUndefined();
    expect(state.marketListings.get("listing:test-1")?.[MarketListingRecord.name]).toMatchObject({
      status: "active",
      version: 0,
    });
  });

  test("returns TRANSACTION_UNSUPPORTED without mutating state when Mongo cannot transact", async () => {
    state.supportsTransactions = false;
    state.users.set("seller-1", {
      _id: "seller-1",
      [UserInventory.name]: { slots: { wood: { qty: 10 } } },
    });

    const result = await createListingTx(fakeCtx, {
      listing: makeListing({ quantity: 4 }),
      config: cfg,
    });

    expect(result.isErr()).toBe(true);
    expect(result.error).toBeInstanceOf(MarketPersistenceError);
    expect(result.error.code).toBe("TRANSACTION_UNSUPPORTED");
    expect(state.users.get("seller-1")?.[UserInventory.name]).toEqual({
      slots: { wood: { qty: 10 } },
    });
    expect(state.marketListings.size).toBe(0);
  });
});
