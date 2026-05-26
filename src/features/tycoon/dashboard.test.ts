/**
 * Dashboard text checks for tycoon state that commands enforce at collect time.
 */

import { describe, expect, test } from "bun:test";
import { RpgProfile } from "@/components/rpg-profile";
import { UserFactory } from "@/components/user-factory";
import { UserInventory } from "@/components/user-inventory";
import type { Component, Ctx } from "@/framework/types";
import { eventSeed, rollEvent } from "./accrual";
import { renderDashboard } from "./dashboard";

const USER = "user-1";

interface ComponentNode {
  readonly data?: { readonly content?: string };
  readonly components?: readonly unknown[];
}

function collectText(node: unknown): string[] {
  if (!node || typeof node !== "object") return [];
  const component = node as ComponentNode;
  const own = typeof component.data?.content === "string" ? [component.data.content] : [];
  const childText = component.components?.flatMap(collectText) ?? [];
  return [...own, ...childText];
}

function payloadText(payload: { readonly components: readonly unknown[] }): string {
  return payload.components.flatMap(collectText).join("\n");
}

function payloadJson(payload: { readonly components: readonly unknown[] }): string {
  return JSON.stringify(payload.components);
}

/** Minimal dashboard Ctx for component reads. */
function makeCtx(seed: Record<string, Record<string, unknown>>): Ctx {
  function bucket(coll: string): Record<string, unknown> {
    seed[coll] ??= {};
    return seed[coll];
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
    async set() {},
    async patch() {},
    async delete() {},
    async query() {
      return [];
    },
    async emit() {},
    client: {},
    logger: { info() {}, warn() {}, error() {}, debug() {} },
    cooldowns: {},
    locks: {},
    sessions: {},
    interaction: null,
  } as unknown as Ctx;
}

function stockpileDashboardCtx(stashSize: number): Ctx {
  return makeCtx({
    [UserFactory.collection]: {
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
    [UserInventory.collection]: { [USER]: { slots: {} } },
    [RpgProfile.collection]: { [USER]: { stashSize } },
    user_currencies: { [USER]: { balances: { coins: 0, scrip: 0 }, bankBalances: {} } },
  });
}

describe("renderDashboard()", () => {
  test("first run console offers the first charter path without a dead collect button", async () => {
    const payload = await renderDashboard(
      makeCtx({
        [UserFactory.collection]: { [USER]: { lines: {}, lifetimeScrip: 0 } },
        user_currencies: { [USER]: { balances: { coins: 500, scrip: 0 }, bankBalances: {} } },
      }),
      USER,
    );

    const body = payloadText(payload);
    const json = payloadJson(payload);
    expect(body).toContain("Shift Briefing");
    expect(body).toContain("Charter Lumber Mill");
    expect(body).toContain("collect output, upgrade the slowest stage, expand into new lines");
    expect(json).not.toContain("Collect Ready");
    expect(json).toContain("Expand or automate");
    expect(json).toContain("charter:lumber_mill");
  });

  test("ready output promotes Collect Ready as the primary action", async () => {
    const payload = await renderDashboard(
      makeCtx({
        [UserFactory.collection]: {
          [USER]: {
            lines: {
              lumber_mill: {
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
            lifetimeScrip: 0,
          },
        },
        user_currencies: { [USER]: { balances: { coins: 0, scrip: 0 }, bankBalances: {} } },
      }),
      USER,
    );

    const body = payloadText(payload);
    const json = payloadJson(payload);
    expect(body).toContain("Shift Briefing");
    expect(body).toContain("Collect ready output");
    expect(json).toContain("Collect Ready");
    expect(json).toContain("tycoon:collect:ready");
  });

  test("warns when stockpile output will not fit in the stash", async () => {
    const payload = await renderDashboard(stockpileDashboardCtx(10), USER);

    const body = payloadText(payload);
    expect(body).toContain("Stash blocked");
    expect(body).toContain("clear stash or upgrade it");
    expect(body.indexOf("Stash blocked")).toBeLessThan(body.indexOf("Fix bottleneck"));
  });

  test("orders bottleneck upgrade options before non-limiting stages", async () => {
    const payload = await renderDashboard(stockpileDashboardCtx(1_000_000), USER);

    const json = payloadJson(payload);
    expect(json.indexOf("lumber_mill:refinery")).toBeGreaterThanOrEqual(0);
    expect(json.indexOf("lumber_mill:refinery")).toBeLessThan(
      json.indexOf("lumber_mill:extractor"),
    );
  });

  test("shows distinct automated, manual full, and manual running statuses", async () => {
    const payload = await renderDashboard(
      makeCtx({
        [UserFactory.collection]: {
          [USER]: {
            lines: {
              lumber_mill: {
                stages: {
                  extractor: { level: 1 },
                  refinery: { level: 1 },
                  assembler: { level: 1 },
                },
                mode: "sell",
                automated: false,
                lastCollectedAt: 0,
              },
              copper_works: {
                stages: {
                  extractor: { level: 1 },
                  refinery: { level: 1 },
                  assembler: { level: 1 },
                },
                mode: "sell",
                automated: true,
                lastCollectedAt: 0,
              },
              iron_works: {
                stages: {
                  extractor: { level: 1 },
                  refinery: { level: 1 },
                  assembler: { level: 1 },
                },
                mode: "sell",
                automated: false,
                lastCollectedAt: Date.now(),
              },
            },
            lifetimeScrip: 0,
          },
        },
        user_currencies: { [USER]: { balances: { coins: 0, scrip: 0 }, bankBalances: {} } },
      }),
      USER,
    );

    const body = payloadText(payload);
    expect(body).toContain("Automated");
    expect(body).toContain("Manual full");
    expect(body).toContain("Manual running");
  });

  test("shows queued collect events without applying them", async () => {
    let anchor = 0;
    for (let i = 0; i < 100; i++) {
      const candidate = i * 60_000;
      if (rollEvent(eventSeed(USER, "lumber_mill", candidate)).id !== "none") {
        anchor = candidate;
        break;
      }
    }

    const ctx = makeCtx({
      [UserFactory.collection]: {
        [USER]: {
          lines: {
            lumber_mill: {
              stages: { extractor: { level: 1 }, refinery: { level: 1 }, assembler: { level: 1 } },
              mode: "sell",
              automated: false,
              lastCollectedAt: anchor,
            },
          },
          lifetimeScrip: 0,
        },
      },
      user_currencies: { [USER]: { balances: { coins: 0, scrip: 0 }, bankBalances: {} } },
    });

    expect(rollEvent(eventSeed(USER, "lumber_mill", anchor)).id).not.toBe("none");
    expect(payloadText(await renderDashboard(ctx, USER))).toContain("Event queued");
  });
});
