/**
 * Tests for economy quests (acceptQuest, progressQuest, claimRewards, getActiveQuests).
 *
 * Quest progress lives on the User entity (`QuestLog` component); the test ctx
 * backs `ctx.of(User, id)` with an in-memory map. `adjustBalance` (used by
 * claimRewards) still reads the wallet through the legacy `get/ensure/patch`
 * surface, so the ctx mock implements both.
 */

import { beforeEach, describe, expect, test } from "bun:test";
import { QuestLog, type QuestLogValue } from "@/components/economy/quests";
import type { Ctx } from "@/framework/types";
import {
  acceptQuest,
  browseQuests,
  claimRewards,
  getActiveQuests,
  progressAllQuests,
  progressQuest,
  QUEST_DEFINITIONS,
  type QuestError,
} from "./quests";

const logs = new Map<string, QuestLogValue>();

function readEntry(userId: string, questId: string) {
  return logs.get(userId)?.entries[questId];
}

function makeCtx() {
  const wallets: Record<string, Record<string, number>> = {};
  return {
    cooldowns: { isOnCooldown: () => false, getRemainingMs: () => 0, set: () => {} },
    sessions: { get: () => undefined, set: () => {}, delete: () => {}, has: () => false },
    locks: { tryAcquire: () => true, release: () => {}, isHeld: () => false },
    client: {} as never,
    logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} } as never,
    interaction: null,
    emit: async () => {},
    of(_kind: unknown, id: string) {
      return {
        async get(component: unknown) {
          if (component !== QuestLog) throw new Error("unexpected component in test ctx");
          return logs.get(id) ?? QuestLog.schema.parse({});
        },
        async update(component: unknown, patch: unknown) {
          if (component !== QuestLog) throw new Error("unexpected component in test ctx");
          const current = logs.get(id) ?? QuestLog.schema.parse({});
          const partial = typeof patch === "function" ? patch(current) : patch;
          logs.set(id, { ...current, ...(partial as Partial<QuestLogValue>) });
        },
      };
    },
    get: async (id: string) => {
      const bal = wallets[id];
      return bal ? ({ balances: bal, bankBalances: {} } as never) : null;
    },
    ensure: async (id: string) => {
      if (!wallets[id]) wallets[id] = { coins: 1000 };
      return { balances: wallets[id], bankBalances: {} } as never;
    },
    patch: async (id: string, _: unknown, fn: unknown) => {
      if (!wallets[id]) wallets[id] = { coins: 1000 };
      const cur = { balances: wallets[id], bankBalances: {} };
      const patch = (typeof fn === "function" ? fn(cur as never) : fn) as {
        balances?: Record<string, number>;
      };
      if (patch.balances) wallets[id] = patch.balances;
    },
    set: async () => {},
    delete: async () => {},
    query: async () => [],
  } as unknown as Ctx;
}

let ctx: Ctx;

beforeEach(() => {
  logs.clear();
  ctx = makeCtx();
});

// ---------------------------------------------------------------------------
// acceptQuest
// ---------------------------------------------------------------------------

describe("acceptQuest", () => {
  test("creates a quest progress entry", async () => {
    const result = await acceptQuest(ctx, "user-1", "quest_gather_stone");

    expect(result.isOk()).toBe(true);
    const doc = result.unwrap();
    expect(doc.questId).toBe("quest_gather_stone");
    expect(doc.stepProgress).toEqual([0]); // 1 step
    expect(doc.completed).toBe(false);
    expect(readEntry("user-1", "quest_gather_stone")).toBeDefined();
  });

  test("returns QUEST_NOT_FOUND for unknown quest", async () => {
    const result = await acceptQuest(ctx, "user-1", "nonexistent_quest");
    expect(result.isErr()).toBe(true);
    expect((result.error as InstanceType<typeof QuestError>).code).toBe("QUEST_NOT_FOUND");
  });

  test("returns QUEST_ALREADY_ACTIVE if already accepted", async () => {
    await acceptQuest(ctx, "user-1", "quest_gather_stone");
    const result = await acceptQuest(ctx, "user-1", "quest_gather_stone");
    expect(result.isErr()).toBe(true);
    expect((result.error as InstanceType<typeof QuestError>).code).toBe("QUEST_ALREADY_ACTIVE");
  });
});

// ---------------------------------------------------------------------------
// progressQuest
// ---------------------------------------------------------------------------

describe("progressQuest", () => {
  test("advances step progress for matching event", async () => {
    await acceptQuest(ctx, "user-1", "quest_gather_stone");

    const result = await progressQuest(ctx, "user-1", "quest_gather_stone", {
      kind: "gather_item",
      itemId: "stone",
      qty: 10,
    });

    expect(result.isOk()).toBe(true);
    const data = result.unwrap();
    expect(data.stepProgress[0]).toBe(10);
    expect(data.completed).toBe(false);
  });

  test("marks quest complete when step target met", async () => {
    await acceptQuest(ctx, "user-1", "quest_gather_stone");

    const result = await progressQuest(ctx, "user-1", "quest_gather_stone", {
      kind: "gather_item",
      itemId: "stone",
      qty: 20,
    });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().completed).toBe(true);

    const doc = readEntry("user-1", "quest_gather_stone");
    expect(doc?.completed).toBe(true);
    expect(doc?.completedAt).toBeDefined();
  });

  test("does not exceed step target", async () => {
    await acceptQuest(ctx, "user-1", "quest_gather_stone");
    await progressQuest(ctx, "user-1", "quest_gather_stone", {
      kind: "gather_item",
      itemId: "stone",
      qty: 30,
    });

    expect(readEntry("user-1", "quest_gather_stone")?.stepProgress[0]).toBe(20); // capped
  });

  test("does not progress wrong event type", async () => {
    await acceptQuest(ctx, "user-1", "quest_gather_stone");
    await progressQuest(ctx, "user-1", "quest_gather_stone", { kind: "fight_win" });

    expect(readEntry("user-1", "quest_gather_stone")?.stepProgress[0]).toBe(0);
  });

  test("does not progress wrong item", async () => {
    await acceptQuest(ctx, "user-1", "quest_gather_stone");
    await progressQuest(ctx, "user-1", "quest_gather_stone", {
      kind: "gather_item",
      itemId: "wood",
      qty: 10,
    });

    expect(readEntry("user-1", "quest_gather_stone")?.stepProgress[0]).toBe(0);
  });

  test("handles multi-step quest independently", async () => {
    // quest_mixed_gather has 2 steps: wood x10, stone x10
    await acceptQuest(ctx, "user-1", "quest_mixed_gather");

    await progressQuest(ctx, "user-1", "quest_mixed_gather", {
      kind: "gather_item",
      itemId: "wood",
      qty: 10,
    });
    expect(readEntry("user-1", "quest_mixed_gather")?.stepProgress).toEqual([10, 0]);
    expect(readEntry("user-1", "quest_mixed_gather")?.completed).toBe(false);

    await progressQuest(ctx, "user-1", "quest_mixed_gather", {
      kind: "gather_item",
      itemId: "stone",
      qty: 10,
    });
    expect(readEntry("user-1", "quest_mixed_gather")?.stepProgress).toEqual([10, 10]);
    expect(readEntry("user-1", "quest_mixed_gather")?.completed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// progressAllQuests
// ---------------------------------------------------------------------------

describe("progressAllQuests", () => {
  test("advances all active quests matching the event", async () => {
    await acceptQuest(ctx, "user-1", "quest_gather_stone");
    await acceptQuest(ctx, "user-1", "quest_gather_wood");

    await progressAllQuests(ctx, "user-1", { kind: "gather_item", itemId: "stone", qty: 5 });

    expect(readEntry("user-1", "quest_gather_stone")?.stepProgress[0]).toBe(5);
    expect(readEntry("user-1", "quest_gather_wood")?.stepProgress[0]).toBe(0); // no wood gathered
  });
});

// ---------------------------------------------------------------------------
// claimRewards
// ---------------------------------------------------------------------------

describe("claimRewards", () => {
  test("claims currency reward for completed quest", async () => {
    await acceptQuest(ctx, "user-1", "quest_gather_stone");
    await progressQuest(ctx, "user-1", "quest_gather_stone", {
      kind: "gather_item",
      itemId: "stone",
      qty: 20,
    });

    const result = await claimRewards(ctx, "user-1", "quest_gather_stone");

    expect(result.isOk()).toBe(true);
    const data = result.unwrap();
    expect(data.rewards.some((r) => r.type === "currency")).toBe(true);
    expect(data.rewards.find((r) => r.type === "currency")?.amount).toBe(150);
    expect(readEntry("user-1", "quest_gather_stone")?.rewardsClaimed).toBe(true);
  });

  test("returns QUEST_NOT_COMPLETED when quest not finished", async () => {
    await acceptQuest(ctx, "user-1", "quest_gather_stone");

    const result = await claimRewards(ctx, "user-1", "quest_gather_stone");
    expect(result.isErr()).toBe(true);
    expect((result.error as InstanceType<typeof QuestError>).code).toBe("QUEST_NOT_COMPLETED");
  });

  test("returns REWARDS_ALREADY_CLAIMED when claimed again", async () => {
    await acceptQuest(ctx, "user-1", "quest_gather_stone");
    await progressQuest(ctx, "user-1", "quest_gather_stone", {
      kind: "gather_item",
      itemId: "stone",
      qty: 20,
    });
    await claimRewards(ctx, "user-1", "quest_gather_stone");

    const result = await claimRewards(ctx, "user-1", "quest_gather_stone");
    expect(result.isErr()).toBe(true);
    expect((result.error as InstanceType<typeof QuestError>).code).toBe("REWARDS_ALREADY_CLAIMED");
  });

  test("returns QUEST_NOT_FOUND for unknown quest", async () => {
    const result = await claimRewards(ctx, "user-1", "unknown_quest");
    expect(result.isErr()).toBe(true);
    expect((result.error as InstanceType<typeof QuestError>).code).toBe("QUEST_NOT_FOUND");
  });
});

// ---------------------------------------------------------------------------
// getActiveQuests
// ---------------------------------------------------------------------------

describe("getActiveQuests", () => {
  test("returns views for all active quests", async () => {
    await acceptQuest(ctx, "user-1", "quest_gather_stone");
    await acceptQuest(ctx, "user-1", "quest_fight_5");
    await progressQuest(ctx, "user-1", "quest_gather_stone", {
      kind: "gather_item",
      itemId: "stone",
      qty: 10,
    });

    const result = await getActiveQuests(ctx, "user-1");
    expect(result.isOk()).toBe(true);
    const quests = result.unwrap();
    expect(quests).toHaveLength(2);

    const stoneQuest = quests.find((q) => q.questId === "quest_gather_stone");
    expect(stoneQuest?.stepProgress[0]).toBe(10);
    expect(stoneQuest?.stepTargets[0]).toBe(20);
    expect(stoneQuest?.completed).toBe(false);
  });

  test("excludes claimed quests", async () => {
    await acceptQuest(ctx, "user-1", "quest_gather_stone");
    await progressQuest(ctx, "user-1", "quest_gather_stone", {
      kind: "gather_item",
      itemId: "stone",
      qty: 20,
    });
    await claimRewards(ctx, "user-1", "quest_gather_stone");

    const result = await getActiveQuests(ctx, "user-1");
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// browseQuests
// ---------------------------------------------------------------------------

describe("browseQuests", () => {
  test("returns all enabled quests", () => {
    const quests = browseQuests();
    expect(quests.length).toBe(QUEST_DEFINITIONS.filter((q) => q.enabled !== false).length);
    expect(quests.every((q) => q.id && q.title && q.stepSummaries.length > 0)).toBe(true);
  });
});
