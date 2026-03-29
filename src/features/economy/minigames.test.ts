/**
 * Tests for economy minigames (coinflip, trivia, rob).
 * Mocks state, account, and mutations modules — no real DB required.
 */

import { describe, expect, test, mock, beforeEach } from "bun:test";
import { OkResult, ErrResult } from "@/core/result";

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
    account: { userId, status, createdAt: NOW, updatedAt: NOW, lastActivityAt: NOW, version: 0 },
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
// Mock @/features/economy/mutations BEFORE importing minigames
// ---------------------------------------------------------------------------

const mockGetBalance = mock(async (_userId: string, _currencyId: string) => OkResult(200));
const mockAdjustBalance = mock(async (_userId: string, _currencyId: string, delta: number) =>
  OkResult({ newBalance: 200 + delta }),
);

mock.module("@/features/economy/mutations", () => ({
  getBalance: mockGetBalance,
  adjustBalance: mockAdjustBalance,
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
  mockGetBalance.mockReset();
  mockAdjustBalance.mockReset();
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
  mockGetBalance.mockImplementation(async () => OkResult(200));
  mockAdjustBalance.mockImplementation(async (_userId: string, _currencyId: string, delta: number) =>
    OkResult({ newBalance: 200 + delta }),
  );
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
    // winnings = 200 - floor(200 * 0.05) = 200 - 10 = 190
    expect(data.winnings).toBe(190);
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
  });

  test("rejects invalid choice", async () => {
    const result = await coinflip("user-1", "invalid" as "heads", 50);
    expect(result.isErr()).toBe(true);
    const err = result.error as MinigameError;
    expect(err).toBeInstanceOf(MinigameError);
    expect(err.code).toBe("INVALID_CHOICE");
  });

  test("rejects bet below minimum", async () => {
    const result = await coinflip("user-1", "heads", 1);
    expect(result.isErr()).toBe(true);
    const err = result.error as MinigameError;
    expect(err).toBeInstanceOf(MinigameError);
    expect(err.code).toBe("BET_TOO_LOW");
  });

  test("rejects bet above maximum", async () => {
    const result = await coinflip("user-1", "heads", 1000);
    expect(result.isErr()).toBe(true);
    const err = result.error as MinigameError;
    expect(err).toBeInstanceOf(MinigameError);
    expect(err.code).toBe("BET_TOO_HIGH");
  });

  test("rejects when on cooldown", async () => {
    mockIsOnCooldown.mockImplementation((userId, key) => key === "coinflip");
    mockGetRemainingMs.mockImplementation(() => 5000);

    const result = await coinflip("user-1", "heads", 50);
    expect(result.isErr()).toBe(true);
    const err = result.error as MinigameError;
    expect(err).toBeInstanceOf(MinigameError);
    expect(err.code).toBe("COOLDOWN_ACTIVE");
  });

  test("rejects insufficient funds", async () => {
    mockGetBalance.mockImplementation(async () => OkResult(10));

    const result = await coinflip("user-1", "heads", 50);
    expect(result.isErr()).toBe(true);
    const err = result.error as MinigameError;
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
    // Start a session manually with a known question
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

    // q1 correctIndex = 1
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
    const err = result.error as MinigameError;
    expect(err).toBeInstanceOf(MinigameError);
    expect(err.code).toBe("SESSION_EXPIRED");
  });

  test("unknown session returns SESSION_NOT_FOUND", async () => {
    const result = await answerTrivia("nonexistent:session", 1);

    expect(result.isErr()).toBe(true);
    const err = result.error as MinigameError;
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
    // Force success: random < failChance (0.35) is false → Math.random() = 0.9
    const origRandom = Math.random;
    Math.random = () => 0.9;

    // Target has 200 coins
    mockGetBalance.mockImplementation(async () => OkResult(200));
    mockAdjustBalance
      .mockResolvedValueOnce(OkResult({ newBalance: 230 })) // robber +stealAmount
      .mockResolvedValueOnce(OkResult({ newBalance: 170 })); // target -stealAmount

    const result = await rob("robber-1", "target-1");
    Math.random = origRandom;

    expect(result.isOk()).toBe(true);
    const data = result.unwrap();
    expect(data.success).toBe(true);
    // stealAmount = min(floor(200 * 0.15), 500) = min(30, 500) = 30
    expect(data.stolenAmount).toBe(30);
    expect(data.fineAmount).toBe(0);
    expect(data.robberNewBalance).toBe(230);
    expect(data.targetNewBalance).toBe(170);
  });

  test("failed rob applies fine to robber", async () => {
    // Force failure: Math.random() = 0.1 → 0.1 < 0.35 (failChance) → failed
    const origRandom = Math.random;
    Math.random = () => 0.1;

    mockGetBalance
      .mockResolvedValueOnce(OkResult(200)) // target balance check
      .mockResolvedValueOnce(OkResult(195)); // robber balance after fine
    mockAdjustBalance.mockResolvedValueOnce(OkResult({ newBalance: 195 })); // fine applied

    const result = await rob("robber-1", "target-1");
    Math.random = origRandom;

    expect(result.isOk()).toBe(true);
    const data = result.unwrap();
    expect(data.success).toBe(false);
    expect(data.stolenAmount).toBe(0);
    // fine = max(floor(30 * 0.2), 5) = max(6, 5) = 6
    expect(data.fineAmount).toBe(6);
    expect(data.robberNewBalance).toBe(195);
  });

  test("rejects when robber is on cooldown", async () => {
    mockIsOnCooldown.mockImplementation((userId, key) => key === "rob");
    mockGetRemainingMs.mockImplementation(() => 120_000);

    const result = await rob("robber-1", "target-1");

    expect(result.isErr()).toBe(true);
    const err = result.error as MinigameError;
    expect(err).toBeInstanceOf(MinigameError);
    expect(err.code).toBe("COOLDOWN_ACTIVE");
  });

  test("rejects self-rob", async () => {
    const result = await rob("user-1", "user-1");

    expect(result.isErr()).toBe(true);
    const err = result.error as MinigameError;
    expect(err).toBeInstanceOf(MinigameError);
    expect(err.code).toBe("INVALID_INPUT");
  });

  test("rejects when target has insufficient funds", async () => {
    mockGetBalance.mockImplementation(async () => OkResult(10)); // below minTargetBalance (50)

    const result = await rob("robber-1", "target-1");

    expect(result.isErr()).toBe(true);
    const err = result.error as MinigameError;
    expect(err).toBeInstanceOf(MinigameError);
    expect(err.code).toBe("TARGET_INSUFFICIENT_FUNDS");
  });
});
