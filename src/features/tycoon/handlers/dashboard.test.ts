/**
 * Interaction tests for the tycoon console's stateful controls.
 */

import { describe, expect, test } from "bun:test";
import { UserCurrency } from "@/components/user-currency";
import { UserFactory } from "@/components/user-factory";
import { locks } from "@/core/state";
import type { Component, Ctx } from "@/framework/types";
import {
  handleCollect,
  handleDoCharter,
  handleDoUpgrade,
  handleExchangeButton,
  handleExchangeSubmit,
  handleExpandSelect,
  handleModeSelect,
} from "./dashboard";

const USER = "user-1";

/** Minimal mutable Ctx for tycoon handler operations. */
function makeCtx(seed: Record<string, Record<string, unknown>> = {}): Ctx {
  const store: Record<string, Record<string, unknown>> = {};
  for (const [coll, byId] of Object.entries(seed)) store[coll] = { ...byId };

  function bucket(coll: string): Record<string, unknown> {
    store[coll] ??= {};
    return store[coll];
  }

  return {
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
}

function wallet(coins = 0, scrip = 0) {
  return {
    [UserCurrency.collection]: { [USER]: { balances: { coins, scrip }, bankBalances: {} } },
  };
}

function factoryWithLumber(
  extra: Partial<{ automated: boolean; mode: "sell" | "stockpile" }> = {},
) {
  return {
    [UserFactory.collection]: {
      [USER]: {
        lines: {
          lumber_mill: {
            stages: { extractor: { level: 1 }, refinery: { level: 1 }, assembler: { level: 1 } },
            mode: extra.mode ?? "sell",
            automated: extra.automated ?? false,
            lastCollectedAt: 0,
          },
        },
        lifetimeScrip: 0,
      },
    },
  };
}

function interaction(customId: string, values: string[] = [], fields?: Record<string, string>) {
  const calls = { editReply: 0, followUp: 0, showModal: 0, reply: 0 };
  const isModal = fields !== undefined;
  return {
    user: { id: USER },
    customId,
    values,
    calls,
    fields: { getTextInputValue: (key: string) => fields?.[key] ?? "" },
    isStringSelectMenu: () => !isModal && values.length > 0,
    isButton: () => !isModal && values.length === 0,
    isModalSubmit: () => isModal,
    async deferUpdate() {},
    async editReply() {
      calls.editReply += 1;
    },
    async followUp() {
      calls.followUp += 1;
    },
    async reply() {
      calls.reply += 1;
    },
    async showModal() {
      calls.showModal += 1;
    },
  };
}

describe("tycoon dashboard handlers", () => {
  test("collect-ready button collects and refreshes the same console", async () => {
    const ctx = makeCtx({ ...wallet(0, 0), ...factoryWithLumber() });
    const i = interaction("tycoon:collect:");

    await handleCollect(i as never, {}, ctx);

    const walletDoc = await ctx.get(USER, UserCurrency);
    expect(walletDoc?.balances.scrip).toBeGreaterThan(0);
    expect(i.calls.editReply).toBe(1);
    expect(i.calls.followUp).toBe(1);
  });

  test("expand select charters a new line", async () => {
    const ctx = makeCtx({ ...wallet(1000, 0) });
    const i = interaction("tycoon:expand:", ["charter:lumber_mill"]);

    await handleExpandSelect(i as never, {}, ctx);

    const factory = await ctx.get(USER, UserFactory);
    expect(factory?.lines.lumber_mill).toBeDefined();
    expect(i.calls.editReply).toBe(1);
  });

  test("expand select automates an owned line", async () => {
    const ctx = makeCtx({ ...wallet(10_000, 0), ...factoryWithLumber() });
    const i = interaction("tycoon:expand:", ["automate:lumber_mill"]);

    await handleExpandSelect(i as never, {}, ctx);

    const factory = await ctx.get(USER, UserFactory);
    expect(factory?.lines.lumber_mill?.automated).toBe(true);
    expect(i.calls.editReply).toBe(1);
  });

  test("output select toggles sell and stockpile mode", async () => {
    const ctx = makeCtx({ ...wallet(0, 0), ...factoryWithLumber() });
    const i = interaction("tycoon:mode:", ["lumber_mill:stockpile"]);

    await handleModeSelect(i as never, {}, ctx);

    const factory = await ctx.get(USER, UserFactory);
    expect(factory?.lines.lumber_mill?.mode).toBe("stockpile");
    expect(i.calls.editReply).toBe(1);
  });

  test("next-action button performs the charter in one tap", async () => {
    const ctx = makeCtx(wallet(1000, 0));
    const i = interaction("tycoon:do-charter:lumber_mill");

    await handleDoCharter(i as never, { line: "lumber_mill" }, ctx);

    const factory = await ctx.get(USER, UserFactory);
    expect(factory?.lines.lumber_mill).toBeDefined();
    expect(i.calls.editReply).toBe(1);
  });

  test("next-action button upgrades a stage in one tap", async () => {
    const ctx = makeCtx({ ...wallet(5000, 0), ...factoryWithLumber() });
    const i = interaction("tycoon:do-upgrade:lumber_mill:refinery");

    await handleDoUpgrade(i as never, { line: "lumber_mill", stage: "refinery" }, ctx);

    const factory = await ctx.get(USER, UserFactory);
    expect(factory?.lines.lumber_mill?.stages.refinery.level).toBe(2);
    expect(i.calls.editReply).toBe(1);
  });

  test("exchange button opens a modal when scrip is available", async () => {
    const ctx = makeCtx(wallet(0, 500));
    const i = interaction("tycoon:exchange:");

    await handleExchangeButton(i as never, {}, ctx);

    expect(i.calls.showModal).toBe(1);
    expect(i.calls.editReply).toBe(0);
  });

  test("exchange button replies instead of opening a modal with no scrip", async () => {
    const ctx = makeCtx(wallet(0, 0));
    const i = interaction("tycoon:exchange:");

    await handleExchangeButton(i as never, {}, ctx);

    expect(i.calls.showModal).toBe(0);
    expect(i.calls.reply).toBe(1);
  });

  test("exchange modal submit converts scrip and refreshes the console", async () => {
    const ctx = makeCtx(wallet(0, 500));
    const i = interaction("tycoon:exchange-submit:", [], { amount: "200" });

    await handleExchangeSubmit(i as never, {}, ctx);

    const walletDoc = await ctx.get(USER, UserCurrency);
    expect(walletDoc?.balances.scrip).toBe(300);
    expect(walletDoc?.balances.coins).toBeGreaterThan(0);
    expect(i.calls.editReply).toBe(1);
    expect(i.calls.followUp).toBe(1);
  });
});
