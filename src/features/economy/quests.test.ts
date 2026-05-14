/**
 * Tests for economy quests (acceptQuest, progressQuest, claimRewards, getActiveQuests).
 * Mocks economy repo and db/repositories/users — no real DB required.
 */

import { describe, expect, test, mock, beforeEach } from "bun:test";
import { OkResult } from "@/core/result";
import type { User } from "@/db/schemas/user";
import type { QuestProgressDoc } from "@/db/schemas/quest";

// ---------------------------------------------------------------------------
// Mock @/core/state BEFORE importing quests
// ---------------------------------------------------------------------------

const lockState = new Set<string>();

mock.module("@/core/state", () => ({
  cooldowns: {
    isOnCooldown: mock(() => false),
    getRemainingMs: mock(() => 0),
    set: mock(() => {}),
  },
  locks: {
    tryAcquire: mock((key: string) => {
      if (lockState.has(key)) return false;
      lockState.add(key);
      return true;
    }),
    release: mock((key: string) => { lockState.delete(key); }),
    isHeld: mock((key: string) => lockState.has(key)),
  },
  sessions: { get: mock(() => undefined), set: mock(() => {}), delete: mock(() => {}), has: mock(() => false) },
}));

// ---------------------------------------------------------------------------
// Mock @/db/repositories/users BEFORE importing quests
// (adjustBalance inside claimRewards uses userStore)
// ---------------------------------------------------------------------------

function makeUser(currency: Record<string, number> = { coins: 100 }): User {
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
// Mock @/db/repositories/economy BEFORE importing quests
// ---------------------------------------------------------------------------

const questStore = new Map<string, QuestProgressDoc>();

const mockQuestGet = mock(async (id: string) =>
  OkResult<QuestProgressDoc | null>(questStore.get(id) ?? null),
);
const mockQuestSet = mock(async (_id: string, doc: QuestProgressDoc) => {
  questStore.set(doc._id, doc);
  return OkResult(doc);
});
const mockGetActiveQuests = mock(async (userId: string) =>
  OkResult(Array.from(questStore.values()).filter((q) => q.userId === userId && !q.rewardsClaimed)),
);

mock.module("@/db/repositories/economy", () => ({
  questProgressStore: { get: mockQuestGet, set: mockQuestSet },
  getActiveQuestsForUser: mockGetActiveQuests,
  // achievement/market stubs (not used in quest tests)
  marketStore: { get: mock(async () => OkResult(null)), set: mock(async () => OkResult(null)) },
  findActiveListings: mock(async () => OkResult([])),
  countActiveListings: mock(async () => OkResult(0)),
  achievementProgressStore: { get: mock(async () => OkResult(null)), set: mock(async () => OkResult(null)) },
  achievementUnlocksStore: { get: mock(async () => OkResult(null)), set: mock(async () => OkResult(null)) },
  getUnlocksForUser: mock(async () => OkResult([])),
  getProgressForUser: mock(async () => OkResult([])),
}));

// ---------------------------------------------------------------------------
// Import AFTER mocking
// ---------------------------------------------------------------------------

const {
  acceptQuest,
  progressQuest,
  progressAllQuests,
  claimRewards,
  getActiveQuests,
  browseQuests,
  QuestError,
  QUEST_DEFINITIONS,
} = await import("./quests");

// ---------------------------------------------------------------------------
// Reset helpers
// ---------------------------------------------------------------------------

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
    get: async (id: string) => {
      const bal = wallets[id];
      return bal ? { balances: bal, bankBalances: {} } as never : null;
    },
    ensure: async (id: string) => {
      if (!wallets[id]) wallets[id] = { coins: 1000 };
      return { balances: wallets[id], bankBalances: {} } as never;
    },
    patch: async (id: string, _: unknown, fn: unknown) => {
      if (!wallets[id]) wallets[id] = { coins: 1000 };
      const cur = { balances: wallets[id], bankBalances: {} };
      const patch = (typeof fn === "function" ? fn(cur as never) : fn) as { balances?: Record<string, number> };
      if (patch.balances) wallets[id] = patch.balances;
    },
    set: async () => {},
    delete: async () => {},
    query: async () => [],
  } as unknown as import("@/framework/types").Ctx;
}

function resetAll() {
  questStore.clear();
  lockState.clear();
  mockQuestGet.mockReset();
  mockQuestSet.mockReset();
  mockGetActiveQuests.mockReset();
  mockUserGet.mockReset();
  mockUserEnsure.mockReset();
  mockUserUpdatePaths.mockReset();

  mockQuestGet.mockImplementation(async (id: string) =>
    OkResult<QuestProgressDoc | null>(questStore.get(id) ?? null),
  );
  mockQuestSet.mockImplementation(async (_id: string, doc: QuestProgressDoc) => {
    questStore.set(doc._id, doc);
    return OkResult(doc);
  });
  mockGetActiveQuests.mockImplementation(async (userId: string) =>
    OkResult(Array.from(questStore.values()).filter((q) => q.userId === userId && !q.rewardsClaimed)),
  );
  mockUserGet.mockImplementation(async () => OkResult<User | null>(makeUser()));
  mockUserEnsure.mockImplementation(async () => OkResult(makeUser()));
  mockUserUpdatePaths.mockImplementation(async () => OkResult(undefined as void));
}

// ---------------------------------------------------------------------------
// acceptQuest tests
// ---------------------------------------------------------------------------

describe("acceptQuest", () => {
  beforeEach(resetAll);

  test("creates a quest progress doc", async () => {
    const result = await acceptQuest("user-1", "quest_gather_stone");

    expect(result.isOk()).toBe(true);
    const doc = result.unwrap();
    expect(doc.questId).toBe("quest_gather_stone");
    expect(doc.userId).toBe("user-1");
    expect(doc.stepProgress).toEqual([0]); // 1 step
    expect(doc.completed).toBe(false);
    expect(questStore.has("user-1:quest_gather_stone")).toBe(true);
  });

  test("returns QUEST_NOT_FOUND for unknown quest", async () => {
    const result = await acceptQuest("user-1", "nonexistent_quest");
    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof QuestError>;
    expect(err.code).toBe("QUEST_NOT_FOUND");
  });

  test("returns QUEST_ALREADY_ACTIVE if already accepted", async () => {
    await acceptQuest("user-1", "quest_gather_stone");
    const result = await acceptQuest("user-1", "quest_gather_stone");
    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof QuestError>;
    expect(err.code).toBe("QUEST_ALREADY_ACTIVE");
  });
});

// ---------------------------------------------------------------------------
// progressQuest tests
// ---------------------------------------------------------------------------

describe("progressQuest", () => {
  beforeEach(resetAll);

  test("advances step progress for matching event", async () => {
    await acceptQuest("user-1", "quest_gather_stone");

    const result = await progressQuest("user-1", "quest_gather_stone", {
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
    await acceptQuest("user-1", "quest_gather_stone");

    const result = await progressQuest("user-1", "quest_gather_stone", {
      kind: "gather_item",
      itemId: "stone",
      qty: 20,
    });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().completed).toBe(true);

    const doc = questStore.get("user-1:quest_gather_stone");
    expect(doc?.completed).toBe(true);
    expect(doc?.completedAt).toBeDefined();
  });

  test("does not exceed step target", async () => {
    await acceptQuest("user-1", "quest_gather_stone");
    await progressQuest("user-1", "quest_gather_stone", { kind: "gather_item", itemId: "stone", qty: 30 });

    const doc = questStore.get("user-1:quest_gather_stone");
    expect(doc?.stepProgress[0]).toBe(20); // capped at target
  });

  test("does not progress wrong event type", async () => {
    await acceptQuest("user-1", "quest_gather_stone");
    await progressQuest("user-1", "quest_gather_stone", { kind: "fight_win" });

    const doc = questStore.get("user-1:quest_gather_stone");
    expect(doc?.stepProgress[0]).toBe(0);
  });

  test("does not progress wrong item", async () => {
    await acceptQuest("user-1", "quest_gather_stone");
    await progressQuest("user-1", "quest_gather_stone", { kind: "gather_item", itemId: "wood", qty: 10 });

    const doc = questStore.get("user-1:quest_gather_stone");
    expect(doc?.stepProgress[0]).toBe(0);
  });

  test("handles multi-step quest independently", async () => {
    // quest_mixed_gather has 2 steps: wood x10, stone x10
    await acceptQuest("user-1", "quest_mixed_gather");

    await progressQuest("user-1", "quest_mixed_gather", { kind: "gather_item", itemId: "wood", qty: 10 });
    let doc = questStore.get("user-1:quest_mixed_gather");
    expect(doc?.stepProgress).toEqual([10, 0]);
    expect(doc?.completed).toBe(false);

    await progressQuest("user-1", "quest_mixed_gather", { kind: "gather_item", itemId: "stone", qty: 10 });
    doc = questStore.get("user-1:quest_mixed_gather");
    expect(doc?.stepProgress).toEqual([10, 10]);
    expect(doc?.completed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// progressAllQuests tests
// ---------------------------------------------------------------------------

describe("progressAllQuests", () => {
  beforeEach(resetAll);

  test("advances all active quests matching the event", async () => {
    await acceptQuest("user-1", "quest_gather_stone");
    await acceptQuest("user-1", "quest_gather_wood");

    await progressAllQuests("user-1", { kind: "gather_item", itemId: "stone", qty: 5 });

    const stoneDom = questStore.get("user-1:quest_gather_stone");
    const woodDoc = questStore.get("user-1:quest_gather_wood");
    expect(stoneDom?.stepProgress[0]).toBe(5);
    expect(woodDoc?.stepProgress[0]).toBe(0); // no wood gathered
  });
});

// ---------------------------------------------------------------------------
// claimRewards tests
// ---------------------------------------------------------------------------

describe("claimRewards", () => {
  beforeEach(resetAll);

  test("claims currency reward for completed quest", async () => {
    await acceptQuest("user-1", "quest_gather_stone");
    await progressQuest("user-1", "quest_gather_stone", { kind: "gather_item", itemId: "stone", qty: 20 });

    const result = await claimRewards(makeCtx(), "user-1", "quest_gather_stone");

    expect(result.isOk()).toBe(true);
    const data = result.unwrap();
    expect(data.rewards.some((r) => r.type === "currency")).toBe(true);
    expect(data.rewards.find((r) => r.type === "currency")?.amount).toBe(150);

    const doc = questStore.get("user-1:quest_gather_stone");
    expect(doc?.rewardsClaimed).toBe(true);
  });

  test("returns QUEST_NOT_COMPLETED when quest not finished", async () => {
    await acceptQuest("user-1", "quest_gather_stone");

    const result = await claimRewards(makeCtx(), "user-1", "quest_gather_stone");
    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof QuestError>;
    expect(err.code).toBe("QUEST_NOT_COMPLETED");
  });

  test("returns REWARDS_ALREADY_CLAIMED when claimed again", async () => {
    await acceptQuest("user-1", "quest_gather_stone");
    await progressQuest("user-1", "quest_gather_stone", { kind: "gather_item", itemId: "stone", qty: 20 });
    await claimRewards(makeCtx(), "user-1", "quest_gather_stone");

    const result = await claimRewards(makeCtx(), "user-1", "quest_gather_stone");
    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof QuestError>;
    expect(err.code).toBe("REWARDS_ALREADY_CLAIMED");
  });

  test("returns QUEST_NOT_FOUND for unknown quest", async () => {
    const result = await claimRewards(makeCtx(), "user-1", "unknown_quest");
    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof QuestError>;
    expect(err.code).toBe("QUEST_NOT_FOUND");
  });
});

// ---------------------------------------------------------------------------
// getActiveQuests tests
// ---------------------------------------------------------------------------

describe("getActiveQuests", () => {
  beforeEach(resetAll);

  test("returns views for all active quests", async () => {
    await acceptQuest("user-1", "quest_gather_stone");
    await acceptQuest("user-1", "quest_fight_5");
    await progressQuest("user-1", "quest_gather_stone", { kind: "gather_item", itemId: "stone", qty: 10 });

    const result = await getActiveQuests("user-1");
    expect(result.isOk()).toBe(true);
    const quests = result.unwrap();
    expect(quests).toHaveLength(2);

    const stoneQuest = quests.find((q) => q.questId === "quest_gather_stone");
    expect(stoneQuest?.stepProgress[0]).toBe(10);
    expect(stoneQuest?.stepTargets[0]).toBe(20);
    expect(stoneQuest?.completed).toBe(false);
  });

  test("excludes claimed quests", async () => {
    await acceptQuest("user-1", "quest_gather_stone");
    await progressQuest("user-1", "quest_gather_stone", { kind: "gather_item", itemId: "stone", qty: 20 });
    await claimRewards(makeCtx(), "user-1", "quest_gather_stone");

    const result = await getActiveQuests("user-1");
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// browseQuests tests
// ---------------------------------------------------------------------------

describe("browseQuests", () => {
  test("returns all enabled quests", () => {
    const quests = browseQuests();
    expect(quests.length).toBe(QUEST_DEFINITIONS.filter((q) => q.enabled !== false).length);
    expect(quests.every((q) => q.id && q.title && q.stepSummaries.length > 0)).toBe(true);
  });
});
