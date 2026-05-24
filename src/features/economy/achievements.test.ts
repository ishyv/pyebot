/**
 * Tests for economy achievements (updateProgress, incrementProgress, claimRewards, getBoard).
 * Mocks economy repo and db/repositories/users — no real DB required.
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";
import { OkResult } from "@/core/result";
import type { AchievementProgressDoc, UnlockedAchievementDoc } from "@/db/schemas/achievement";
import type { User } from "@/db/schemas/user";

// ---------------------------------------------------------------------------
// Mock @/db/repositories/users BEFORE importing achievements
// (adjustBalance inside claimRewards uses userStore)
// ---------------------------------------------------------------------------

function makeUser(_currency: Record<string, number> = { coins: 100 }): User {
  return {
    _id: "user-1",
    sanction_history: {},
    mod_notes: {},
    quarantine_roles: {},
  };
}

const mockUserGet = mock(async (_id: string) => OkResult<User | null>(makeUser()));
const mockUserEnsure = mock(async (_id: string) => OkResult(makeUser()));
const mockUserUpdatePaths = mock(async (_id: string, _paths: Record<string, unknown>) =>
  OkResult(undefined),
);

mock.module("@/db/repositories/users", () => ({
  userStore: {
    get: mockUserGet,
    ensure: mockUserEnsure,
    updatePaths: mockUserUpdatePaths,
  },
}));

// ---------------------------------------------------------------------------
// Mock @/db/repositories/economy BEFORE importing achievements
// ---------------------------------------------------------------------------

const progressStore = new Map<string, AchievementProgressDoc>();
const unlocksStore = new Map<string, UnlockedAchievementDoc>();

const mockProgressGet = mock(async (id: string) => {
  return OkResult<AchievementProgressDoc | null>(progressStore.get(id) ?? null);
});
const mockProgressSet = mock(async (_id: string, doc: AchievementProgressDoc) => {
  progressStore.set(doc._id, doc);
  return OkResult(doc);
});
const mockProgressFind = mock(async (_filter: unknown) =>
  OkResult(Array.from(progressStore.values())),
);

const mockUnlocksGet = mock(async (id: string) => {
  return OkResult<UnlockedAchievementDoc | null>(unlocksStore.get(id) ?? null);
});
const mockUnlocksSet = mock(async (_id: string, doc: UnlockedAchievementDoc) => {
  unlocksStore.set(doc._id, doc);
  return OkResult(doc);
});
const mockUnlocksFind = mock(async (_filter: unknown) =>
  OkResult(Array.from(unlocksStore.values())),
);

mock.module("@/db/repositories/economy", () => ({
  achievementProgressStore: {
    get: mockProgressGet,
    set: mockProgressSet,
    find: mockProgressFind,
  },
  achievementUnlocksStore: {
    get: mockUnlocksGet,
    set: mockUnlocksSet,
    find: mockUnlocksFind,
  },
  getUnlocksForUser: mock(async (_userId: string) =>
    OkResult(Array.from(unlocksStore.values()).filter((u) => u.userId === _userId)),
  ),
  getProgressForUser: mock(async (_userId: string) =>
    OkResult(Array.from(progressStore.values()).filter((p) => p.userId === _userId)),
  ),
  // market store stubs (not used in achievements tests)
  marketStore: {
    get: mock(async () => OkResult(null)),
    set: mock(async () => OkResult(null)),
    replaceIfMatch: mock(async () => OkResult(null)),
  },
  findActiveListings: mock(async () => OkResult([])),
  countActiveListings: mock(async () => OkResult(0)),
  // quest store stubs (not used in achievements tests)
  questProgressStore: {
    get: mock(async () => OkResult(null)),
    set: mock(async () => OkResult(null)),
  },
  getActiveQuestsForUser: mock(async () => OkResult([])),
}));

// ---------------------------------------------------------------------------
// Import AFTER mocking
// ---------------------------------------------------------------------------

const {
  updateProgress,
  incrementProgress,
  claimRewards,
  getBoard,
  AchievementError,
  ACHIEVEMENT_DEFINITIONS,
} = await import("./achievements");

// ---------------------------------------------------------------------------
// Ctx stub for claimRewards (adjustBalance now requires ctx)
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
  } as unknown as import("@/framework/types").Ctx;
}

// ---------------------------------------------------------------------------
// Reset helpers
// ---------------------------------------------------------------------------

function resetAll() {
  progressStore.clear();
  unlocksStore.clear();
  mockProgressGet.mockReset();
  mockProgressSet.mockReset();
  mockUnlocksGet.mockReset();
  mockUnlocksSet.mockReset();
  mockUserGet.mockReset();
  mockUserEnsure.mockReset();
  mockUserUpdatePaths.mockReset();

  mockProgressGet.mockImplementation(async (id: string) =>
    OkResult<AchievementProgressDoc | null>(progressStore.get(id) ?? null),
  );
  mockProgressSet.mockImplementation(async (_id: string, doc: AchievementProgressDoc) => {
    progressStore.set(doc._id, doc);
    return OkResult(doc);
  });
  mockUnlocksGet.mockImplementation(async (id: string) =>
    OkResult<UnlockedAchievementDoc | null>(unlocksStore.get(id) ?? null),
  );
  mockUnlocksSet.mockImplementation(async (_id: string, doc: UnlockedAchievementDoc) => {
    unlocksStore.set(doc._id, doc);
    return OkResult(doc);
  });
  mockUserGet.mockImplementation(async () => OkResult<User | null>(makeUser()));
  mockUserEnsure.mockImplementation(async () => OkResult(makeUser()));
  mockUserUpdatePaths.mockImplementation(async () => OkResult(undefined));
}

// ---------------------------------------------------------------------------
// updateProgress tests
// ---------------------------------------------------------------------------

describe("updateProgress", () => {
  beforeEach(resetAll);

  test("sets progress for matching achievements", async () => {
    const result = await updateProgress("user-1", "trivia_wins", 5);

    expect(result.isOk()).toBe(true);
    const data = result.unwrap();
    expect(data.newlyUnlocked).toHaveLength(0); // trivia_10 target is 10, not reached yet

    // Progress should be stored for trivia_10 and trivia_50
    const storedKeys = Array.from(progressStore.keys());
    expect(storedKeys.some((k) => k.includes("trivia_10"))).toBe(true);
    expect(storedKeys.some((k) => k.includes("trivia_50"))).toBe(true);
  });

  test("unlocks achievement when progress meets target", async () => {
    const result = await updateProgress("user-1", "trivia_wins", 10);

    expect(result.isOk()).toBe(true);
    const data = result.unwrap();
    expect(data.newlyUnlocked).toContain("trivia_10");
    expect(data.newlyUnlocked).not.toContain("trivia_50"); // target 50 not met
    expect(unlocksStore.has("user-1:trivia_10")).toBe(true);
  });

  test("does not re-unlock an already unlocked achievement", async () => {
    // First unlock
    await updateProgress("user-1", "trivia_wins", 10);
    const firstUnlock = unlocksStore.get("user-1:trivia_10");
    if (!firstUnlock) throw new Error("Expected trivia_10 to be unlocked");

    // Second update at same value
    const result = await updateProgress("user-1", "trivia_wins", 10);
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().newlyUnlocked).toHaveLength(0); // not newly unlocked

    // Unlock record should be unchanged
    const afterUnlock = unlocksStore.get("user-1:trivia_10");
    if (!afterUnlock) throw new Error("Expected trivia_10 unlock to remain stored");
    expect(afterUnlock.unlockedAt.getTime()).toBe(firstUnlock.unlockedAt.getTime());
  });

  test("caps stored progress at target", async () => {
    await updateProgress("user-1", "trivia_wins", 100);

    const triviaDoc = progressStore.get("user-1:trivia_10");
    expect(triviaDoc?.progress).toBe(10); // capped at target
  });
});

// ---------------------------------------------------------------------------
// incrementProgress tests
// ---------------------------------------------------------------------------

describe("incrementProgress", () => {
  beforeEach(resetAll);

  test("increments from 0 by default amount of 1", async () => {
    await incrementProgress("user-1", "trivia_wins");

    const doc = progressStore.get("user-1:trivia_10");
    expect(doc?.progress).toBe(1);
  });

  test("accumulates increments correctly", async () => {
    for (let i = 0; i < 9; i++) {
      await incrementProgress("user-1", "trivia_wins");
    }
    expect(progressStore.get("user-1:trivia_10")?.progress).toBe(9);
    expect(unlocksStore.has("user-1:trivia_10")).toBe(false);

    const result = await incrementProgress("user-1", "trivia_wins");
    expect(result.unwrap().newlyUnlocked).toContain("trivia_10");
    expect(unlocksStore.has("user-1:trivia_10")).toBe(true);
  });

  test("skips already-unlocked achievements", async () => {
    // Pre-populate unlock
    unlocksStore.set("user-1:trivia_10", {
      _id: "user-1:trivia_10",
      userId: "user-1",
      achievementId: "trivia_10",
      unlockedAt: new Date(),
      rewardsClaimed: false,
    });

    const result = await incrementProgress("user-1", "trivia_wins", 50);
    // trivia_10 is already unlocked, should not appear in newlyUnlocked
    expect(result.unwrap().newlyUnlocked).not.toContain("trivia_10");
  });
});

// ---------------------------------------------------------------------------
// claimRewards tests
// ---------------------------------------------------------------------------

describe("claimRewards", () => {
  beforeEach(resetAll);

  test("claims currency reward for unlocked achievement", async () => {
    unlocksStore.set("user-1:trivia_10", {
      _id: "user-1:trivia_10",
      userId: "user-1",
      achievementId: "trivia_10",
      unlockedAt: new Date(),
      rewardsClaimed: false,
    });

    const result = await claimRewards(makeCtx(), "user-1", "trivia_10");

    expect(result.isOk()).toBe(true);
    const data = result.unwrap();
    expect(data.appliedRewards).toHaveLength(1);
    expect(data.appliedRewards[0].type).toBe("currency");
    expect(data.appliedRewards[0].amount).toBe(300);

    // Marked as claimed
    const unlock = unlocksStore.get("user-1:trivia_10");
    expect(unlock?.rewardsClaimed).toBe(true);
  });

  test("returns ACHIEVEMENT_NOT_FOUND for unknown achievement", async () => {
    const result = await claimRewards(makeCtx(), "user-1", "nonexistent");
    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof AchievementError>;
    expect(err).toBeInstanceOf(AchievementError);
    expect(err.code).toBe("ACHIEVEMENT_NOT_FOUND");
  });

  test("returns ACHIEVEMENT_NOT_UNLOCKED when not unlocked", async () => {
    const result = await claimRewards(makeCtx(), "user-1", "trivia_10");
    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof AchievementError>;
    expect(err.code).toBe("ACHIEVEMENT_NOT_UNLOCKED");
  });

  test("returns REWARDS_ALREADY_CLAIMED when claimed again", async () => {
    unlocksStore.set("user-1:trivia_10", {
      _id: "user-1:trivia_10",
      userId: "user-1",
      achievementId: "trivia_10",
      unlockedAt: new Date(),
      rewardsClaimed: true,
    });

    const result = await claimRewards(makeCtx(), "user-1", "trivia_10");
    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof AchievementError>;
    expect(err.code).toBe("REWARDS_ALREADY_CLAIMED");
  });
});

// ---------------------------------------------------------------------------
// getBoard tests
// ---------------------------------------------------------------------------

describe("getBoard", () => {
  beforeEach(resetAll);

  test("returns all achievements with progress and unlock state", async () => {
    // Pre-populate some state
    progressStore.set("user-1:trivia_10", {
      _id: "user-1:trivia_10",
      userId: "user-1",
      achievementId: "trivia_10",
      progress: 7,
      target: 10,
      completed: false,
      updatedAt: new Date(),
    });
    unlocksStore.set("user-1:streak_7", {
      _id: "user-1:streak_7",
      userId: "user-1",
      achievementId: "streak_7",
      unlockedAt: new Date(),
      rewardsClaimed: true,
    });

    const result = await getBoard("user-1");
    expect(result.isOk()).toBe(true);
    const board = result.unwrap();

    expect(board.totalCount).toBe(ACHIEVEMENT_DEFINITIONS.length);
    expect(board.unlockedCount).toBe(1);

    const triviaView = board.achievements.find((a) => a.id === "trivia_10");
    expect(triviaView?.progress).toBe(7);
    expect(triviaView?.isUnlocked).toBe(false);

    const streakView = board.achievements.find((a) => a.id === "streak_7");
    expect(streakView?.isUnlocked).toBe(true);
    expect(streakView?.rewardsClaimed).toBe(true);
  });

  test("returns empty board for new user", async () => {
    const result = await getBoard("new-user");
    expect(result.isOk()).toBe(true);
    const board = result.unwrap();
    expect(board.unlockedCount).toBe(0);
    board.achievements.forEach((a) => {
      expect(a.progress).toBe(0);
      expect(a.isUnlocked).toBe(false);
    });
  });
});
