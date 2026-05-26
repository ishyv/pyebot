/**
 * Tests for the tycoon service (in-memory multi-component Ctx, real locks).
 */

import { describe, expect, test } from "bun:test";
import { locks } from "@/core/state";
import type { Component, Ctx } from "@/framework/types";
import { eventSeed, rollEvent } from "./accrual";
import { LINES } from "./content/lines";
import { charter, collect, getScrip, upgrade } from "./operations";

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
    async query() {
      return [];
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
