/**
 * Interaction tests for the tycoon console's stateful controls.
 */

import { describe, expect, test } from "bun:test";
import { UserCurrency } from "@/components/economy/wallet";
import { User } from "@/components/entities";
import { UserFactory } from "@/components/user-factory";
import { locks } from "@/core/state";
import type { EntityComponent, EntityKind } from "@/framework";
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

  return {
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
    async query() {
      return [];
    },
    of(kind: EntityKind, id: string) {
      void kind;
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
          writeEntity(id, component, patch);
        },
      };
    },
    select() {
      throw new Error("select not implemented in tycoon handler test ctx");
    },
    transaction() {
      throw new Error("transaction not implemented in tycoon handler test ctx");
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
    [User.collection]: {
      [USER]: { [UserCurrency.name]: { balances: { coins, scrip }, bankBalances: {} } },
    },
  };
}

function factoryWithLumber(
  extra: Partial<{ automated: boolean; mode: "sell" | "stockpile" }> = {},
) {
  return {
    [User.collection]: {
      [USER]: {
        [UserFactory.name]: {
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
    const ctx = makeCtx(seed(wallet(0, 0), factoryWithLumber()));
    const i = interaction("tycoon:collect:");

    await handleCollect(i as never, {}, ctx);

    const walletDoc = await ctx.of(User, USER).peek(UserCurrency);
    expect(walletDoc?.balances.scrip).toBeGreaterThan(0);
    expect(i.calls.editReply).toBe(1);
    expect(i.calls.followUp).toBe(1);
  });

  test("expand select charters a new line", async () => {
    const ctx = makeCtx({ ...wallet(1000, 0) });
    const i = interaction("tycoon:expand:", ["charter:lumber_mill"]);

    await handleExpandSelect(i as never, {}, ctx);

    const factory = await ctx.of(User, USER).get(UserFactory);
    expect(factory.lines.lumber_mill).toBeDefined();
    expect(i.calls.editReply).toBe(1);
  });

  test("expand select automates an owned line", async () => {
    const ctx = makeCtx(seed(wallet(10_000, 0), factoryWithLumber()));
    const i = interaction("tycoon:expand:", ["automate:lumber_mill"]);

    await handleExpandSelect(i as never, {}, ctx);

    const factory = await ctx.of(User, USER).get(UserFactory);
    expect(factory.lines.lumber_mill?.automated).toBe(true);
    expect(i.calls.editReply).toBe(1);
  });

  test("output select toggles sell and stockpile mode", async () => {
    const ctx = makeCtx(seed(wallet(0, 0), factoryWithLumber()));
    const i = interaction("tycoon:mode:", ["lumber_mill:stockpile"]);

    await handleModeSelect(i as never, {}, ctx);

    const factory = await ctx.of(User, USER).get(UserFactory);
    expect(factory.lines.lumber_mill?.mode).toBe("stockpile");
    expect(i.calls.editReply).toBe(1);
  });

  test("next-action button performs the charter in one tap", async () => {
    const ctx = makeCtx(wallet(1000, 0));
    const i = interaction("tycoon:do-charter:lumber_mill");

    await handleDoCharter(i as never, { line: "lumber_mill" }, ctx);

    const factory = await ctx.of(User, USER).get(UserFactory);
    expect(factory.lines.lumber_mill).toBeDefined();
    expect(i.calls.editReply).toBe(1);
  });

  test("next-action button upgrades a stage in one tap", async () => {
    const ctx = makeCtx(seed(wallet(5000, 0), factoryWithLumber()));
    const i = interaction("tycoon:do-upgrade:lumber_mill:refinery");

    await handleDoUpgrade(i as never, { line: "lumber_mill", stage: "refinery" }, ctx);

    const factory = await ctx.of(User, USER).get(UserFactory);
    expect(factory.lines.lumber_mill?.stages.refinery.level).toBe(2);
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

    const walletDoc = await ctx.of(User, USER).peek(UserCurrency);
    expect(walletDoc?.balances.scrip).toBe(300);
    expect(walletDoc?.balances.coins).toBeGreaterThan(0);
    expect(i.calls.editReply).toBe(1);
    expect(i.calls.followUp).toBe(1);
  });
});
