/**
 * Tests for the tycoon service (in-memory multi-component Ctx, real locks).
 */

import { describe, expect, test } from "bun:test";
import { UserCurrency } from "@/components/economy/wallet";
import { User } from "@/components/entities";
import { UserInventory } from "@/components/rpg/inventory";
import { RpgProfile } from "@/components/rpg/profile";
import { UserFactory } from "@/components/user-factory";
import { locks } from "@/core/state";
import type { EntityComponent, EntityKind } from "@/framework";
import type { Component, Ctx } from "@/framework/types";
import { eventSeed, rollEvent } from "./accrual";
import { LINES } from "./content/lines";
import {
  automate,
  charter,
  coinsInvested,
  collect,
  EXCHANGE_FEE,
  exchange,
  getScrip,
  netWorth,
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

  function readEntity<T>(id: string, component: EntityComponent<T>): T | null {
    const doc = bucket(component.kind.collection)[id] as Record<string, unknown> | undefined;
    if (!doc || !(component.name in doc)) return null;
    return component.schema.parse(doc[component.name]);
  }

  function writeEntity<T>(
    id: string,
    component: EntityComponent<T>,
    patch: Partial<T> | ((current: T) => Partial<T>),
  ) {
    const b = bucket(component.kind.collection);
    if (!(id in b)) b[id] = { _id: id };
    const doc = b[id] as Record<string, unknown>;
    const current = component.schema.parse(doc[component.name] ?? {});
    const partial = typeof patch === "function" ? patch(current) : patch;
    doc[component.name] = { ...current, ...partial };
  }

  const ctx = {
    async get<T>(id: string, component: Component<T> | EntityComponent<T>) {
      if ("kind" in component) return readEntity(id, component);
      return (bucket(component.collection)[id] as T) ?? null;
    },
    async ensure<T>(id: string, component: Component<T> | EntityComponent<T>) {
      if ("kind" in component) {
        const existing = readEntity(id, component);
        if (existing) return existing;
        writeEntity(id, component, component.schema.parse({}));
        return readEntity(id, component) as T;
      }
      const b = bucket(component.collection);
      if (!(id in b)) b[id] = component.schema.parse({});
      return b[id] as T;
    },
    async set<T>(id: string, component: Component<T> | EntityComponent<T>, value: T) {
      if ("kind" in component) {
        const b = bucket(component.kind.collection);
        if (!(id in b)) b[id] = { _id: id };
        const doc = b[id] as Record<string, unknown>;
        doc[component.name] = value;
        return;
      }
      bucket(component.collection)[id] = value;
    },
    async patch<T>(
      id: string,
      component: Component<T> | EntityComponent<T>,
      patch: Partial<T> | ((current: T) => Partial<T>),
    ) {
      if ("kind" in component) {
        writeEntity(id, component, patch);
        return;
      }
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
    of(kind: EntityKind, id: string) {
      return {
        async get<T>(component: EntityComponent<T>) {
          return readEntity(id, component) ?? component.schema.parse({});
        },
        async peek<T>(component: EntityComponent<T>) {
          return readEntity(id, component);
        },
        async update<T>(
          component: EntityComponent<T>,
          patch: Partial<T> | ((current: T) => Partial<T>),
        ) {
          void kind;
          writeEntity(id, component, patch);
        },
      };
    },
    select<T>(component: EntityComponent<T>) {
      return {
        run: async () =>
          Object.entries(bucket(component.kind.collection))
            .filter(([, doc]) => component.name in (doc as Record<string, unknown>))
            .map(([id, doc]) => ({
              id,
              value: component.schema.parse((doc as Record<string, unknown>)[component.name]),
            })),
      };
    },
    transaction() {
      throw new Error("transaction not implemented in tycoon operations test ctx");
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
  return {
    [User.collection]: {
      [USER]: { [UserCurrency.name]: { balances: { coins, scrip }, bankBalances: {} } },
    },
  };
}

function seed(...parts: Record<string, Record<string, unknown>>[]) {
  const merged: Record<string, Record<string, unknown>> = {};
  for (const part of parts) {
    for (const [collection, docs] of Object.entries(part)) {
      merged[collection] ??= {};
      for (const [id, doc] of Object.entries(docs)) {
        merged[collection][id] = {
          ...((merged[collection][id] as Record<string, unknown> | undefined) ?? {}),
          ...(doc as Record<string, unknown>),
        };
      }
    }
  }
  return merged;
}

describe("charter()", () => {
  test("debits coins and creates the line in sell mode", async () => {
    const ctx = makeCtx(wallet(1000));
    const res = await charter(ctx, USER, "lumber_mill");
    expect(res.isOk()).toBe(true);
    expect(await getScrip(ctx, USER)).toBe(0);
    const factory = await ctx.of(User, USER).get(UserFactory);
    expect(factory.lines.lumber_mill?.mode).toBe("sell");
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
    return seed(wallet(0, 0), {
      [User.collection]: {
        [USER]: {
          [UserFactory.name]: {
            lines: {
              lumber_mill: {
                stages: {
                  extractor: { level: 1 },
                  refinery: { level: 1 },
                  assembler: { level: 1 },
                },
                mode: "sell",
                automated: false,
                lastCollectedAt,
              },
            },
            lifetimeScrip: 0,
          },
        },
      },
    });
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
  return seed(wallet(0, 0), {
    [User.collection]: {
      [USER]: {
        [UserInventory.name]: { slots: {} },
        [RpgProfile.name]: { stashSize },
        [UserFactory.name]: {
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
    },
  });
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
    const inv = await ctx.of(User, USER).peek(UserInventory);
    const slot = inv?.slots[LINES.lumber_mill.refinedMaterialId];
    expect(slot && "qty" in slot ? slot.qty : 0).toBeGreaterThan(0);
  });

  test("halts with STASH_FULL and keeps the anchor when the stash can't hold the output", async () => {
    const ctx = makeCtx(stockpileFactory(10));
    const res = await collect(ctx, USER, "lumber_mill");
    expect(res.isErr()).toBe(true);
    if (res.isErr()) expect(res.error.code).toBe("STASH_FULL");
    // Anchor preserved → a later collect (with room) would still pay out.
    const factory = await ctx.of(User, USER).get(UserFactory);
    expect(factory.lines.lumber_mill?.lastCollectedAt).toBe(0);
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
    const factory = await ctx.of(User, USER).get(UserFactory);
    expect(factory.lines.lumber_mill?.mode).toBe("stockpile");
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

describe("coinsInvested() and netWorth()", () => {
  test("counts charter cost, completed upgrades, and automation", () => {
    const invested = coinsInvested("lumber_mill", {
      stages: { extractor: { level: 3 }, refinery: { level: 2 }, assembler: { level: 1 } },
      mode: "sell",
      automated: true,
      lastCollectedAt: 0,
    });

    expect(invested).toBe(
      LINES.lumber_mill.charterCost +
        LINES.lumber_mill.stages.extractor.baseUpgradeCost +
        Math.round(
          LINES.lumber_mill.stages.extractor.baseUpgradeCost *
            LINES.lumber_mill.stages.extractor.upgradeCostMult,
        ) +
        LINES.lumber_mill.stages.refinery.baseUpgradeCost +
        LINES.lumber_mill.automationCost,
    );
  });

  test("adds lifetime scrip, current scrip, and invested coins", async () => {
    const ctx = makeCtx(
      seed(wallet(0, 200), {
        [User.collection]: {
          [USER]: {
            [UserFactory.name]: {
              lines: {
                lumber_mill: {
                  stages: {
                    extractor: { level: 2 },
                    refinery: { level: 1 },
                    assembler: { level: 1 },
                  },
                  mode: "sell",
                  automated: false,
                  lastCollectedAt: 0,
                },
              },
              lifetimeScrip: 1000,
            },
          },
        },
      }),
    );

    expect(await netWorth(ctx, USER)).toBe(1000 + 200 + LINES.lumber_mill.charterCost + 120);
  });

  test("exchange spending leaves lifetime scrip intact but lowers current-scrip value", async () => {
    const ctx = makeCtx(
      seed(wallet(0, 1000), {
        [User.collection]: { [USER]: { [UserFactory.name]: { lines: {}, lifetimeScrip: 5000 } } },
      }),
    );

    expect(await netWorth(ctx, USER)).toBe(6000);
    await exchange(ctx, USER, 400);
    expect(await netWorth(ctx, USER)).toBe(5600);
  });
});

describe("topMagnates()", () => {
  test("ranks by net worth and keeps lifetime scrip for display", async () => {
    const ctx = makeCtx({
      [User.collection]: {
        rich: {
          [UserCurrency.name]: { balances: { scrip: 0 }, bankBalances: {} },
          [UserFactory.name]: { lines: {}, lifetimeScrip: 9000 },
        },
        investor: {
          [UserCurrency.name]: { balances: { scrip: 0 }, bankBalances: {} },
          [UserFactory.name]: {
            lines: {
              silver_forge: {
                stages: {
                  extractor: { level: 1 },
                  refinery: { level: 1 },
                  assembler: { level: 1 },
                },
                mode: "sell",
                automated: false,
                lastCollectedAt: 0,
              },
            },
            lifetimeScrip: 100,
          },
        },
        mid: {
          [UserCurrency.name]: { balances: { scrip: 50 }, bankBalances: {} },
          [UserFactory.name]: { lines: {}, lifetimeScrip: 500 },
        },
        broke: {
          [UserCurrency.name]: { balances: { scrip: 0 }, bankBalances: {} },
          [UserFactory.name]: { lines: {}, lifetimeScrip: 0 },
        },
      },
    });
    const top = await topMagnates(ctx, 10);
    expect(top.map((e) => e.userId)).toEqual(["investor", "rich", "mid"]);
    expect(top[0].netWorth).toBe(LINES.silver_forge.charterCost + 100);
    expect(top[0].lifetimeScrip).toBe(100);
  });
});
