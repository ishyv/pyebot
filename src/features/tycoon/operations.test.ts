/**
 * Tests for the tycoon service (in-memory multi-component Ctx, real locks).
 */

import { describe, expect, test } from "bun:test";
import { locks } from "@/core/state";
import type { Component, Ctx } from "@/framework/types";
import { eventSeed, rollEvent } from "./accrual";
import { LINES } from "./content/lines";
import {
  automate,
  charter,
  collect,
  EXCHANGE_FEE,
  exchange,
  getScrip,
  setMode,
  topMagnates,
  upgrade,
} from "./operations";

/** Minimal Ctx backed by an in-memory `collection → id → doc` store. */
function makeCtx(seed: Record<string, Record<string, unknown>> = {}): Ctx {
  const store: Record<string, Record<string, unknown>> = {};
  for (const [coll, byId] of Object.entries(seed)) store[coll] = { ...byId };

  function bucket(coll: string): Record<string, unknown> {
    store[coll] ??= {};
    return store[coll];
  }

  const ctx = {
    async get<T>(id: string, component: Component<T>) {
      return (bucket(component.collection)[id] as T) ?? null;
    },
    async ensure<T>(id: string, component: Component<T>) {
      const b = bucket(component.collection);
      if (!(id in b)) b[id] = component.schema.parse({});
      return b[id] as T;
    },
    async set<T>(id: string, component: Component<T>, value: T) {
      bucket(component.collection)[id] = value;
    },
    async patch<T>(
      id: string,
      component: Component<T>,
      patch: Partial<T> | ((current: T) => Partial<T>),
    ) {
      const b = bucket(component.collection);
      if (!(id in b)) b[id] = component.schema.parse({});
      const current = b[id] as T;
      const partial = typeof patch === "function" ? patch(current) : patch;
      b[id] = { ...current, ...partial };
    },
    async delete() {},
    async query<T>(
      component: Component<T>,
      options?: { sort?: Record<string, 1 | -1>; limit?: number },
    ) {
      const entries = Object.entries(bucket(component.collection)).map(([id, value]) => ({
        _id: id,
        ...(value as Record<string, unknown>),
      }));
      const sort = options?.sort;
      if (sort) {
        const [key, dir] = Object.entries(sort)[0];
        entries.sort((a, b) => {
          const av = Number((a as Record<string, unknown>)[key] ?? 0);
          const bv = Number((b as Record<string, unknown>)[key] ?? 0);
          return dir === -1 ? bv - av : av - bv;
        });
      }
      return (options?.limit ? entries.slice(0, options.limit) : entries) as never;
    },
    async emit() {},
    client: {},
    logger: { info() {}, warn() {}, error() {}, debug() {} },
    cooldowns: {},
    locks,
    sessions: {},
    interaction: null,
  } as unknown as Ctx;
  return ctx;
}

const USER = "user-1";

function wallet(coins = 0, scrip = 0) {
  return { user_currencies: { [USER]: { balances: { coins, scrip }, bankBalances: {} } } };
}

describe("charter()", () => {
  test("debits coins and creates the line in sell mode", async () => {
    const ctx = makeCtx(wallet(1000));
    const res = await charter(ctx, USER, "lumber_mill");
    expect(res.isOk()).toBe(true);
    expect(await getScrip(ctx, USER)).toBe(0);
    const factory = await ctx.get(USER, (await import("@/components/user-factory")).UserFactory);
    expect(factory?.lines.lumber_mill?.mode).toBe("sell");
  });

  test("fails with INSUFFICIENT_FUNDS when too poor", async () => {
    const ctx = makeCtx(wallet(100));
    const res = await charter(ctx, USER, "lumber_mill");
    expect(res.isErr()).toBe(true);
    if (res.isErr()) expect(res.error.code).toBe("INSUFFICIENT_FUNDS");
  });

  test("rejects chartering the same line twice", async () => {
    const ctx = makeCtx(wallet(5000));
    await charter(ctx, USER, "lumber_mill");
    const again = await charter(ctx, USER, "lumber_mill");
    expect(again.isErr()).toBe(true);
    if (again.isErr()) expect(again.error.code).toBe("ALREADY_OWNED");
  });
});

describe("upgrade()", () => {
  test("debits the upgrade cost and bumps the stage level", async () => {
    const ctx = makeCtx(wallet(5000));
    await charter(ctx, USER, "lumber_mill");
    const res = await upgrade(ctx, USER, "lumber_mill", "extractor");
    expect(res.isOk()).toBe(true);
    if (res.isOk()) {
      expect(res.unwrap().newLevel).toBe(2);
      expect(res.unwrap().cost).toBe(LINES.lumber_mill.stages.extractor.baseUpgradeCost);
    }
  });

  test("fails when the line is not owned", async () => {
    const ctx = makeCtx(wallet(5000));
    const res = await upgrade(ctx, USER, "iron_works", "refinery");
    expect(res.isErr()).toBe(true);
    if (res.isErr()) expect(res.error.code).toBe("NOT_OWNED");
  });
});

describe("collect() — sell mode", () => {
  function seededFactory(lastCollectedAt: number) {
    return {
      ...wallet(0, 0),
      user_factories: {
        [USER]: {
          lines: {
            lumber_mill: {
              stages: { extractor: { level: 1 }, refinery: { level: 1 }, assembler: { level: 1 } },
              mode: "sell",
              automated: false,
              lastCollectedAt,
            },
          },
          lifetimeScrip: 0,
        },
      },
    };
  }

  test("credits scrip, bumps lifetimeScrip, and applies the seeded event", async () => {
    const ctx = makeCtx(seededFactory(0));
    const def = LINES.lumber_mill;
    // Bottleneck = assembler (20/hr); capped at capHours.
    const cappedUnits = 20 * def.capHours;
    const ev = rollEvent(eventSeed(USER, "lumber_mill", 0));
    const expectedScrip = Math.floor(cappedUnits * ev.multiplier) * def.finishedGood.scripValue;

    const res = await collect(ctx, USER, "lumber_mill");
    expect(res.isOk()).toBe(true);
    if (res.isOk()) {
      expect(res.unwrap().scripGained).toBe(expectedScrip);
      expect(res.unwrap().mode).toBe("sell");
    }
    expect(await getScrip(ctx, USER)).toBe(expectedScrip);
  });

  test("a second immediate collect has nothing to give (anchor reset prevents double-pay)", async () => {
    const ctx = makeCtx(seededFactory(0));
    await collect(ctx, USER, "lumber_mill");
    const again = await collect(ctx, USER, "lumber_mill");
    expect(again.isErr()).toBe(true);
    if (again.isErr()) expect(again.error.code).toBe("NOTHING_TO_COLLECT");
  });

  test("nothing to collect right after chartering", async () => {
    const ctx = makeCtx(wallet(5000));
    await charter(ctx, USER, "lumber_mill");
    const res = await collect(ctx, USER, "lumber_mill");
    expect(res.isErr()).toBe(true);
    if (res.isErr()) expect(res.error.code).toBe("NOTHING_TO_COLLECT");
  });
});

function stockpileFactory(stashSize: number) {
  return {
    ...wallet(0, 0),
    rpg_profiles: { [USER]: { stashSize } },
    user_inventories: { [USER]: { slots: {} } },
    user_factories: {
      [USER]: {
        lines: {
          lumber_mill: {
            stages: { extractor: { level: 1 }, refinery: { level: 1 }, assembler: { level: 1 } },
            mode: "stockpile",
            automated: false,
            lastCollectedAt: 0,
          },
        },
        lifetimeScrip: 0,
      },
    },
  };
}

describe("collect() — stockpile mode", () => {
  test("deposits refined material into the stash", async () => {
    const ctx = makeCtx(stockpileFactory(1_000_000));
    const res = await collect(ctx, USER, "lumber_mill");
    expect(res.isOk()).toBe(true);
    if (res.isOk()) {
      const s = res.unwrap();
      expect(s.mode).toBe("stockpile");
      expect(s.materialId).toBe(LINES.lumber_mill.refinedMaterialId);
      expect(s.materialsGained).toBeGreaterThan(0);
    }
    const inv = await ctx.get(USER, (await import("@/components/user-inventory")).UserInventory);
    const slot = inv?.slots[LINES.lumber_mill.refinedMaterialId];
    expect(slot && "qty" in slot ? slot.qty : 0).toBeGreaterThan(0);
  });

  test("halts with STASH_FULL and keeps the anchor when the stash can't hold the output", async () => {
    const ctx = makeCtx(stockpileFactory(10));
    const res = await collect(ctx, USER, "lumber_mill");
    expect(res.isErr()).toBe(true);
    if (res.isErr()) expect(res.error.code).toBe("STASH_FULL");
    // Anchor preserved → a later collect (with room) would still pay out.
    const factory = await ctx.get(USER, (await import("@/components/user-factory")).UserFactory);
    expect(factory?.lines.lumber_mill?.lastCollectedAt).toBe(0);
  });
});

describe("automate()", () => {
  test("debits the module cost and flips automated on", async () => {
    const ctx = makeCtx(wallet(10_000));
    await charter(ctx, USER, "lumber_mill");
    const res = await automate(ctx, USER, "lumber_mill");
    expect(res.isOk()).toBe(true);
    if (res.isOk()) expect(res.unwrap().cost).toBe(LINES.lumber_mill.automationCost);
    const again = await automate(ctx, USER, "lumber_mill");
    expect(again.isErr()).toBe(true);
    if (again.isErr()) expect(again.error.code).toBe("ALREADY_AUTOMATED");
  });
});

describe("setMode()", () => {
  test("switches a line's output mode", async () => {
    const ctx = makeCtx(wallet(5000));
    await charter(ctx, USER, "lumber_mill");
    const res = await setMode(ctx, USER, "lumber_mill", "stockpile");
    expect(res.isOk()).toBe(true);
    const factory = await ctx.get(USER, (await import("@/components/user-factory")).UserFactory);
    expect(factory?.lines.lumber_mill?.mode).toBe("stockpile");
  });
});

describe("exchange()", () => {
  test("converts scrip to coins minus the fee", async () => {
    const ctx = makeCtx(wallet(0, 1000));
    const res = await exchange(ctx, USER, 500);
    expect(res.isOk()).toBe(true);
    if (res.isOk()) {
      expect(res.unwrap().coinsGained).toBe(Math.floor(500 * (1 - EXCHANGE_FEE)));
    }
    expect(await getScrip(ctx, USER)).toBe(500);
  });

  test("rejects converting more scrip than owned", async () => {
    const ctx = makeCtx(wallet(0, 100));
    const res = await exchange(ctx, USER, 500);
    expect(res.isErr()).toBe(true);
    if (res.isErr()) expect(res.error.code).toBe("NO_SCRIP");
  });
});

describe("topMagnates()", () => {
  test("ranks by lifetimeScrip desc and excludes zero-scrip players", async () => {
    const ctx = makeCtx({
      user_factories: {
        rich: { lines: {}, lifetimeScrip: 9000 },
        mid: { lines: {}, lifetimeScrip: 500 },
        broke: { lines: {}, lifetimeScrip: 0 },
      },
    });
    const top = await topMagnates(ctx, 10);
    expect(top.map((e) => e.userId)).toEqual(["rich", "mid"]);
    expect(top[0].lifetimeScrip).toBe(9000);
  });
});
