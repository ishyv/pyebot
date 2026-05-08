/**
 * Tests for economy minigames (coinflip, trivia, rob).
 * Mocks state, account, and userStore — no real DB required.
 *
 * NOTE: We deliberately mock @/db/repositories/users (not @/features/economy/mutations)
 * to avoid Bun module mock cross-contamination with mutations.test.ts.
 */

import { describe, expect, test, mock, beforeEach } from "bun:test";
import { OkResult } from "@/core/result";
import type { User } from "@/db/schemas/user";

// ---------------------------------------------------------------------------
// Mock @/core/state BEFORE importing minigames
// ---------------------------------------------------------------------------

const mockIsOnCooldown = mock((_userId: string, _key: string) => false);
const mockGetRemainingMs = mock((_userId: string, _key: string) => 0);
const mockSetCooldown = mock((_userId: string, _key: string, _ms: number) => {});

const sessionStore = new Map<string, unknown>();
const mockSessionsGet = mock((key: string) => sessionStore.get(key));
const mockSessionsSet = mock((key: string, value: unknown) => { sessionStore.set(key, value); });
const mockSessionsDelete = mock((key: string) => { sessionStore.delete(key); });

mock.module("@/core/state", () => ({
  cooldowns: {
    isOnCooldown: mockIsOnCooldown,
    getRemainingMs: mockGetRemainingMs,
    set: mockSetCooldown,
  },
  sessions: {
    get: mockSessionsGet,
    set: mockSessionsSet,
    delete: mockSessionsDelete,
    has: (key: string) => sessionStore.has(key),
  },
}));

// ---------------------------------------------------------------------------
// Mock @/features/economy/account BEFORE importing minigames
// ---------------------------------------------------------------------------

const NOW = new Date("2026-01-01T00:00:00.000Z");

function makeAccountResult(userId: string, status: "ok" | "blocked" | "banned" = "ok") {
  return OkResult({
    account: { userId, status, createdAt: NOW, updatedAt: NOW, lastActivityAt: NOW, version: 0, dailyStreak: 0, lastDailyAt: null },
    isNew: false,
  });
}

const mockEnsureAccount = mock(async (userId: string) => makeAccountResult(userId));
const mockIsAccountActive = mock((status: string) => status === "ok");

mock.module("@/features/economy/account", () => ({
  ensureAccount: mockEnsureAccount,
  isAccountActive: mockIsAccountActive,
}));

// ---------------------------------------------------------------------------
// Mock @/db/repositories/users BEFORE importing minigames
// (mutations.ts uses userStore directly — mocking here avoids cross-test contamination)
// ---------------------------------------------------------------------------

function makeUser(currency: Record<string, number> = { coins: 200 }): User {
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

const mockGet = mock(async (_id: string) => OkResult<User | null>(makeUser()));
const mockEnsure = mock(async (_id: string) => OkResult(makeUser()));
const mockUpdatePaths = mock(
  async (_id: string, _paths: Record<string, unknown>) => OkResult(undefined as void),
);

mock.module("@/db/repositories/users", () => ({
  userStore: {
    get: mockGet,
    ensure: mockEnsure,
    updatePaths: mockUpdatePaths,
  },
}));

// ---------------------------------------------------------------------------
// Import AFTER mocking
// ---------------------------------------------------------------------------

const { coinflip, startTrivia, answerTrivia, rob, MinigameError } = await import("./minigames");

// ---------------------------------------------------------------------------
// Reset helpers
// ---------------------------------------------------------------------------

function resetAll() {
  mockIsOnCooldown.mockReset();
  mockGetRemainingMs.mockReset();
  mockSetCooldown.mockReset();
  mockEnsureAccount.mockReset();
  mockIsAccountActive.mockReset();
  mockGet.mockReset();
  mockEnsure.mockReset();
  mockUpdatePaths.mockReset();
  sessionStore.clear();
  mockSessionsGet.mockReset();
  mockSessionsSet.mockReset();
  mockSessionsDelete.mockReset();

  // Restore session store behavior after reset
  mockSessionsGet.mockImplementation((key: string) => sessionStore.get(key));
  mockSessionsSet.mockImplementation((key: string, value: unknown) => { sessionStore.set(key, value); });
  mockSessionsDelete.mockImplementation((key: string) => { sessionStore.delete(key); });

  // Safe defaults
  mockIsOnCooldown.mockImplementation(() => false);
  mockGetRemainingMs.mockImplementation(() => 0);
  mockSetCooldown.mockImplementation(() => {});
  mockEnsureAccount.mockImplementation(async (userId: string) => makeAccountResult(userId));
  mockIsAccountActive.mockImplementation((status: string) => status === "ok");
  mockGet.mockImplementation(async () => OkResult<User | null>(makeUser()));
  mockEnsure.mockImplementation(async () => OkResult(makeUser()));
  mockUpdatePaths.mockImplementation(async () => OkResult(undefined as void));
}

// ---------------------------------------------------------------------------
// coinflip tests
// ---------------------------------------------------------------------------

describe("coinflip", () => {
  beforeEach(resetAll);

  test("wins correctly when choice matches outcome", async () => {
    // Force Math.random to return 0.1 → outcome = "heads"
    const origRandom = Math.random;
    Math.random = () => 0.1;

    const result = await coinflip("user-1", "heads", 100);
    Math.random = origRandom;

    expect(result.isOk()).toBe(true);
    const data = result.unwrap();
    expect(data.won).toBe(true);
    expect(data.outcome).toBe("heads");
    expect(data.choice).toBe("heads");
    expect(data.betAmount).toBe(100);
    // winnings = 200 - floor(200 * 0.05) = 190
    expect(data.winnings).toBe(190);
    // newBalance = 200 + (190 - 100) = 290
    expect(data.newBalance).toBe(290);
  });

  test("loses correctly when choice does not match outcome", async () => {
    // Force Math.random to return 0.6 → outcome = "tails"
    const origRandom = Math.random;
    Math.random = () => 0.6;

    const result = await coinflip("user-1", "heads", 50);
    Math.random = origRandom;

    expect(result.isOk()).toBe(true);
    const data = result.unwrap();
    expect(data.won).toBe(false);
    expect(data.outcome).toBe("tails");
    expect(data.choice).toBe("heads");
    expect(data.winnings).toBe(0);
    // newBalance = 200 - 50 = 150
    expect(data.newBalance).toBe(150);
  });

  test("rejects invalid choice", async () => {
    const result = await coinflip("user-1", "invalid" as "heads", 50);
    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof MinigameError>;
    expect(err).toBeInstanceOf(MinigameError);
    expect(err.code).toBe("INVALID_CHOICE");
  });

  test("rejects bet below minimum", async () => {
    const result = await coinflip("user-1", "heads", 1);
    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof MinigameError>;
    expect(err).toBeInstanceOf(MinigameError);
    expect(err.code).toBe("BET_TOO_LOW");
  });

  test("rejects bet above maximum", async () => {
    const result = await coinflip("user-1", "heads", 1000);
    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof MinigameError>;
    expect(err).toBeInstanceOf(MinigameError);
    expect(err.code).toBe("BET_TOO_HIGH");
  });

  test("rejects when on cooldown", async () => {
    mockIsOnCooldown.mockImplementation((_userId: string, key: string) => key === "coinflip");
    mockGetRemainingMs.mockImplementation(() => 5000);

    const result = await coinflip("user-1", "heads", 50);
    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof MinigameError>;
    expect(err).toBeInstanceOf(MinigameError);
    expect(err.code).toBe("COOLDOWN_ACTIVE");
  });

  test("rejects insufficient funds", async () => {
    // userStore.get returns user with only 10 coins (getBalance reads from here)
    mockGet.mockImplementation(async () => OkResult<User | null>(makeUser({ coins: 10 })));

    const result = await coinflip("user-1", "heads", 50);
    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof MinigameError>;
    expect(err).toBeInstanceOf(MinigameError);
    expect(err.code).toBe("INSUFFICIENT_FUNDS");
  });
});

// ---------------------------------------------------------------------------
// startTrivia / answerTrivia tests
// ---------------------------------------------------------------------------

describe("startTrivia", () => {
  beforeEach(resetAll);

  test("returns question and session key", async () => {
    const result = await startTrivia("user-1", "guild-1");

    expect(result.isOk()).toBe(true);
    const data = result.unwrap();
    expect(data.sessionKey).toBe("user-1:guild-1");
    expect(data.question).toBeDefined();
    expect(data.question.options).toHaveLength(4);
    expect(data.timeoutMs).toBe(60_000);
  });
});

describe("answerTrivia", () => {
  beforeEach(resetAll);

  test("correct answer returns reward and sets cooldown", async () => {
    // Start a session manually with a known question (q1 correctIndex = 1)
    const session = {
      questionId: "q1",
      userId: "user-1",
      guildId: "guild-1",
      startedAt: Date.now(),
      currencyId: "coins",
      baseReward: 20,
      difficulty: 1 as const,
    };
    sessionStore.set("user-1:guild-1", session);

    const result = await answerTrivia("user-1:guild-1", 1);

    expect(result.isOk()).toBe(true);
    const data = result.unwrap();
    expect(data.correct).toBe(true);
    expect(data.reward).toBe(20); // difficulty 1 → 1x multiplier
    expect(data.correctIndex).toBe(1);
    expect(mockSetCooldown).toHaveBeenCalledWith("user-1", "trivia", 30_000);
  });

  test("wrong answer returns 0 reward", async () => {
    const session = {
      questionId: "q1",
      userId: "user-1",
      guildId: "guild-1",
      startedAt: Date.now(),
      currencyId: "coins",
      baseReward: 20,
      difficulty: 1 as const,
    };
    sessionStore.set("user-1:guild-1", session);

    // q1 correctIndex = 1, we answer 0
    const result = await answerTrivia("user-1:guild-1", 0);

    expect(result.isOk()).toBe(true);
    const data = result.unwrap();
    expect(data.correct).toBe(false);
    expect(data.reward).toBe(0);
    expect(data.newBalance).toBe(0);
  });

  test("expired session returns SESSION_EXPIRED", async () => {
    const session = {
      questionId: "q1",
      userId: "user-1",
      guildId: "guild-1",
      startedAt: Date.now() - 90_000, // 90 seconds ago
      currencyId: "coins",
      baseReward: 20,
      difficulty: 1 as const,
    };
    sessionStore.set("user-1:guild-1", session);

    const result = await answerTrivia("user-1:guild-1", 1, 60_000);

    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof MinigameError>;
    expect(err).toBeInstanceOf(MinigameError);
    expect(err.code).toBe("SESSION_EXPIRED");
  });

  test("unknown session returns SESSION_NOT_FOUND", async () => {
    const result = await answerTrivia("nonexistent:session", 1);

    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof MinigameError>;
    expect(err).toBeInstanceOf(MinigameError);
    expect(err.code).toBe("SESSION_NOT_FOUND");
  });
});

// ---------------------------------------------------------------------------
// rob tests
// ---------------------------------------------------------------------------

describe("rob", () => {
  beforeEach(resetAll);

  test("successful rob transfers coins to robber and deducts from target", async () => {
    // Force success: Math.random() = 0.9, failChance = 0.35 → 0.9 >= 0.35 → success
    const origRandom = Math.random;
    Math.random = () => 0.9;

    // Both users start with 200 coins
    // target balance check uses userStore.get; adjustBalance uses userStore.ensure
    const result = await rob("robber-1", "target-1");
    Math.random = origRandom;

    expect(result.isOk()).toBe(true);
    const data = result.unwrap();
    expect(data.success).toBe(true);
    // stealAmount = min(floor(200 * 0.15), 500) = min(30, 500) = 30
    expect(data.stolenAmount).toBe(30);
    expect(data.fineAmount).toBe(0);
    // robber 200 + 30 = 230
    expect(data.robberNewBalance).toBe(230);
    // target 200 - 30 = 170
    expect(data.targetNewBalance).toBe(170);
  });

  test("failed rob applies fine to robber", async () => {
    // Force failure: Math.random() = 0.1 → 0.1 < 0.35 (failChance) → failed
    const origRandom = Math.random;
    Math.random = () => 0.1;

    // Rob calls getBalance(targetId) [mockGet call 1] then, after fine,
    // getBalance(robberId) [mockGet call 2]. Sequence the mocks accordingly.
    mockGet
      .mockResolvedValueOnce(OkResult<User | null>(makeUser({ coins: 200 }))) // target balance check
      .mockResolvedValueOnce(OkResult<User | null>(makeUser({ coins: 194 }))); // robber after fine

    const result = await rob("robber-1", "target-1");
    Math.random = origRandom;

    expect(result.isOk()).toBe(true);
    const data = result.unwrap();
    expect(data.success).toBe(false);
    expect(data.stolenAmount).toBe(0);
    // fine = max(floor(30 * 0.2), 5) = max(6, 5) = 6
    expect(data.fineAmount).toBe(6);
    // robber balance after fine reported by getBalance re-read
    expect(data.robberNewBalance).toBe(194);
  });

  test("rejects when robber is on cooldown", async () => {
    mockIsOnCooldown.mockImplementation((_userId: string, key: string) => key === "rob");
    mockGetRemainingMs.mockImplementation(() => 120_000);

    const result = await rob("robber-1", "target-1");

    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof MinigameError>;
    expect(err).toBeInstanceOf(MinigameError);
    expect(err.code).toBe("COOLDOWN_ACTIVE");
  });

  test("rejects self-rob", async () => {
    const result = await rob("user-1", "user-1");

    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof MinigameError>;
    expect(err).toBeInstanceOf(MinigameError);
    expect(err.code).toBe("INVALID_INPUT");
  });

  test("rejects when target has insufficient funds", async () => {
    // Target has only 10 coins (below minTargetBalance of 50)
    mockGet.mockImplementation(async () => OkResult<User | null>(makeUser({ coins: 10 })));

    const result = await rob("robber-1", "target-1");

    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof MinigameError>;
    expect(err).toBeInstanceOf(MinigameError);
    expect(err.code).toBe("TARGET_INSUFFICIENT_FUNDS");
  });
});
