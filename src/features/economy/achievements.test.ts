/**
 * Tests for economy achievements (updateProgress, incrementProgress, claimRewards, getBoard).
 *
 * Storage is the `Achievements` component on the User entity; the test ctx backs
 * `ctx.of(User, id)` with an in-memory map. Currency rewards go through
 * `adjustBalance`, which is mocked here so the suite stays independent of the
 * wallet's own storage.
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Achievements, type AchievementsValue } from "@/components/economy/achievements";
import type { Ctx } from "@/framework/types";

const adjustBalance = mock(
  async (_ctx: unknown, _userId: string, _currencyId: string, _amount: number) => {},
);

mock.module("@/features/economy/mutations", () => ({ adjustBalance }));

const {
  updateProgress,
  incrementProgress,
  claimRewards,
  getBoard,
  AchievementError,
  ACHIEVEMENT_DEFINITIONS,
} = await import("./achievements");

const store = new Map<string, AchievementsValue>();

function read(userId: string): AchievementsValue {
  return store.get(userId) ?? Achievements.schema.parse({});
}

function makeCtx(): Ctx {
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
          if (component !== Achievements) throw new Error("unexpected component in test ctx");
          return store.get(id) ?? Achievements.schema.parse({});
        },
        async update(component: unknown, patch: unknown) {
          if (component !== Achievements) throw new Error("unexpected component in test ctx");
          const current = store.get(id) ?? Achievements.schema.parse({});
          const partial = typeof patch === "function" ? patch(current) : patch;
          store.set(id, { ...current, ...(partial as Partial<AchievementsValue>) });
        },
      };
    },
    get: async () => null,
    ensure: async () => {
      throw new Error("legacy ensure should not be used in achievement tests");
    },
    patch: async () => {
      throw new Error("legacy patch should not be used in achievement tests");
    },
    set: async () => {},
    delete: async () => {},
    query: async () => [],
  } as unknown as Ctx;
}

let ctx: Ctx;

beforeEach(() => {
  store.clear();
  adjustBalance.mockClear();
  ctx = makeCtx();
});

// ---------------------------------------------------------------------------
// updateProgress
// ---------------------------------------------------------------------------

describe("updateProgress", () => {
  test("sets progress for matching achievements", async () => {
    const result = await updateProgress(ctx, "user-1", "trivia_wins", 5);

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().newlyUnlocked).toHaveLength(0); // trivia_10 target is 10

    const { progress } = read("user-1");
    expect(progress.trivia_10).toBeDefined();
    expect(progress.trivia_50).toBeDefined();
  });

  test("unlocks achievement when progress meets target", async () => {
    const result = await updateProgress(ctx, "user-1", "trivia_wins", 10);

    expect(result.isOk()).toBe(true);
    const data = result.unwrap();
    expect(data.newlyUnlocked).toContain("trivia_10");
    expect(data.newlyUnlocked).not.toContain("trivia_50"); // target 50 not met
    expect(read("user-1").unlocked.trivia_10).toBeDefined();
  });

  test("does not re-unlock an already unlocked achievement", async () => {
    await updateProgress(ctx, "user-1", "trivia_wins", 10);
    const firstUnlock = read("user-1").unlocked.trivia_10;
    if (!firstUnlock) throw new Error("Expected trivia_10 to be unlocked");

    const result = await updateProgress(ctx, "user-1", "trivia_wins", 10);
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().newlyUnlocked).toHaveLength(0);

    const afterUnlock = read("user-1").unlocked.trivia_10;
    if (!afterUnlock) throw new Error("Expected trivia_10 unlock to remain stored");
    expect(afterUnlock.unlockedAt.getTime()).toBe(firstUnlock.unlockedAt.getTime());
  });

  test("caps stored progress at target", async () => {
    await updateProgress(ctx, "user-1", "trivia_wins", 100);
    expect(read("user-1").progress.trivia_10?.progress).toBe(10); // capped at target
  });
});

// ---------------------------------------------------------------------------
// incrementProgress
// ---------------------------------------------------------------------------

describe("incrementProgress", () => {
  test("increments from 0 by default amount of 1", async () => {
    await incrementProgress(ctx, "user-1", "trivia_wins");
    expect(read("user-1").progress.trivia_10?.progress).toBe(1);
  });

  test("accumulates increments correctly", async () => {
    for (let i = 0; i < 9; i++) {
      await incrementProgress(ctx, "user-1", "trivia_wins");
    }
    expect(read("user-1").progress.trivia_10?.progress).toBe(9);
    expect(read("user-1").unlocked.trivia_10).toBeUndefined();

    const result = await incrementProgress(ctx, "user-1", "trivia_wins");
    expect(result.unwrap().newlyUnlocked).toContain("trivia_10");
    expect(read("user-1").unlocked.trivia_10).toBeDefined();
  });

  test("skips already-unlocked achievements", async () => {
    store.set("user-1", {
      progress: {},
      unlocked: { trivia_10: { unlockedAt: new Date(), rewardsClaimed: false } },
    });

    const result = await incrementProgress(ctx, "user-1", "trivia_wins", 50);
    expect(result.unwrap().newlyUnlocked).not.toContain("trivia_10");
  });
});

// ---------------------------------------------------------------------------
// claimRewards
// ---------------------------------------------------------------------------

describe("claimRewards", () => {
  test("claims currency reward for unlocked achievement", async () => {
    store.set("user-1", {
      progress: {},
      unlocked: { trivia_10: { unlockedAt: new Date(), rewardsClaimed: false } },
    });

    const result = await claimRewards(ctx, "user-1", "trivia_10");

    expect(result.isOk()).toBe(true);
    const data = result.unwrap();
    expect(data.appliedRewards).toHaveLength(1);
    expect(data.appliedRewards[0].type).toBe("currency");
    expect(data.appliedRewards[0].amount).toBe(300);
    expect(adjustBalance).toHaveBeenCalledTimes(1);
    expect(read("user-1").unlocked.trivia_10?.rewardsClaimed).toBe(true);
  });

  test("returns ACHIEVEMENT_NOT_FOUND for unknown achievement", async () => {
    const result = await claimRewards(ctx, "user-1", "nonexistent");
    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof AchievementError>;
    expect(err).toBeInstanceOf(AchievementError);
    expect(err.code).toBe("ACHIEVEMENT_NOT_FOUND");
  });

  test("returns ACHIEVEMENT_NOT_UNLOCKED when not unlocked", async () => {
    const result = await claimRewards(ctx, "user-1", "trivia_10");
    expect(result.isErr()).toBe(true);
    expect((result.error as InstanceType<typeof AchievementError>).code).toBe(
      "ACHIEVEMENT_NOT_UNLOCKED",
    );
  });

  test("returns REWARDS_ALREADY_CLAIMED when claimed again", async () => {
    store.set("user-1", {
      progress: {},
      unlocked: { trivia_10: { unlockedAt: new Date(), rewardsClaimed: true } },
    });

    const result = await claimRewards(ctx, "user-1", "trivia_10");
    expect(result.isErr()).toBe(true);
    expect((result.error as InstanceType<typeof AchievementError>).code).toBe(
      "REWARDS_ALREADY_CLAIMED",
    );
  });
});

// ---------------------------------------------------------------------------
// getBoard
// ---------------------------------------------------------------------------

describe("getBoard", () => {
  test("returns all achievements with progress and unlock state", async () => {
    store.set("user-1", {
      progress: {
        trivia_10: { progress: 7, target: 10, completed: false, updatedAt: new Date() },
      },
      unlocked: { streak_7: { unlockedAt: new Date(), rewardsClaimed: true } },
    });

    const result = await getBoard(ctx, "user-1");
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
    const result = await getBoard(ctx, "new-user");
    expect(result.isOk()).toBe(true);
    const board = result.unwrap();
    expect(board.unlockedCount).toBe(0);
    for (const a of board.achievements) {
      expect(a.progress).toBe(0);
      expect(a.isUnlocked).toBe(false);
    }
  });
});
