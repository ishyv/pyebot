/**
 * Tests for currency mutations service.
 * Mocks the db layer and account module — no real MongoDB required.
 */

import { describe, expect, test, mock, beforeEach } from "bun:test";
import { OkResult } from "@/core/result";
import type { User } from "@/db/schemas/user";

// ---------------------------------------------------------------------------
// Shared fake user factory
// ---------------------------------------------------------------------------

function makeUser(overrides: Partial<User> = {}): User {
  return {
    _id: "user-1",
    warns: [],
    sanction_history: {},
    openTickets: [],
    currency: {},
    inventory: {},
    mod_notes: {},
    quarantine_roles: {},
    economyAccount: undefined,
    rpgProfile: undefined,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock userStore BEFORE importing mutations module
// ---------------------------------------------------------------------------

const mockGet = mock(async (_id: string) => OkResult<User | null>(null));
const mockEnsure = mock(async (_id: string) => OkResult(makeUser()));
const mockUpdatePaths = mock(
  async (
    _id: string,
    _paths: Record<string, unknown>,
    _opts?: { upsert?: boolean },
  ) => OkResult(undefined as void),
);

mock.module("@/db/repositories/users", () => ({
  userStore: {
    get: mockGet,
    ensure: mockEnsure,
    updatePaths: mockUpdatePaths,
  },
}));

// ---------------------------------------------------------------------------
// Mock account module BEFORE importing mutations module
// ---------------------------------------------------------------------------

const NOW = new Date("2026-01-01T00:00:00.000Z");

function makeAccountResult(userId: string, status: "ok" | "blocked" | "banned" = "ok") {
  return OkResult({
    account: {
      userId,
      status,
      createdAt: NOW,
      updatedAt: NOW,
      lastActivityAt: NOW,
      version: 0,
    },
    isNew: false,
  });
}

const mockEnsureAccount = mock(async (userId: string) => makeAccountResult(userId));
const mockIsAccountActive = mock((status: string) => status === "ok");

mock.module("@/features/economy/account", () => ({
  ensureAccount: mockEnsureAccount,
  isAccountActive: mockIsAccountActive,
}));

// Import AFTER mocking
const { getBalance, adjustBalance, transfer, MutationError } = await import("./mutations");

// ---------------------------------------------------------------------------
// Reset helpers
// ---------------------------------------------------------------------------

function resetMocks() {
  mockGet.mockReset();
  mockEnsure.mockReset();
  mockUpdatePaths.mockReset();
  mockEnsureAccount.mockReset();
  mockIsAccountActive.mockReset();

  // Safe defaults
  mockGet.mockResolvedValue(OkResult<User | null>(null));
  mockEnsure.mockResolvedValue(OkResult(makeUser()));
  mockUpdatePaths.mockResolvedValue(OkResult(undefined as void));
  mockEnsureAccount.mockImplementation(async (userId: string) => makeAccountResult(userId));
  mockIsAccountActive.mockImplementation((status: string) => status === "ok");
}

// ---------------------------------------------------------------------------
// getBalance
// ---------------------------------------------------------------------------

describe("getBalance", () => {
  beforeEach(resetMocks);

  test("returns 0 for unknown user (user not found)", async () => {
    mockGet.mockResolvedValue(OkResult<User | null>(null));

    const result = await getBalance("unknown-user", "coins");
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe(0);
  });

  test("returns 0 when user exists but currency not set", async () => {
    mockGet.mockResolvedValue(OkResult<User | null>(makeUser({ _id: "user-1", currency: {} })));

    const result = await getBalance("user-1", "coins");
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe(0);
  });

  test("returns correct balance when currency exists", async () => {
    mockGet.mockResolvedValue(
      OkResult<User | null>(makeUser({ _id: "user-1", currency: { coins: 150 } })),
    );

    const result = await getBalance("user-1", "coins");
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe(150);
  });
});

// ---------------------------------------------------------------------------
// adjustBalance
// ---------------------------------------------------------------------------

describe("adjustBalance", () => {
  beforeEach(resetMocks);

  test("increases balance by positive delta", async () => {
    mockEnsure.mockResolvedValue(
      OkResult(makeUser({ _id: "user-1", currency: { coins: 100 } })),
    );

    const result = await adjustBalance("user-1", "coins", 50);
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().newBalance).toBe(150);
    expect(mockUpdatePaths).toHaveBeenCalledWith("user-1", { "currency.coins": 150 });
  });

  test("decreases balance by negative delta", async () => {
    mockEnsure.mockResolvedValue(
      OkResult(makeUser({ _id: "user-1", currency: { coins: 200 } })),
    );

    const result = await adjustBalance("user-1", "coins", -80);
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().newBalance).toBe(120);
    expect(mockUpdatePaths).toHaveBeenCalledWith("user-1", { "currency.coins": 120 });
  });

  test("rejects when result would go negative (allowDebt: false by default)", async () => {
    mockEnsure.mockResolvedValue(
      OkResult(makeUser({ _id: "user-1", currency: { coins: 30 } })),
    );

    const result = await adjustBalance("user-1", "coins", -50);
    expect(result.isErr()).toBe(true);
    const error = result.error as InstanceType<typeof MutationError>;
    expect(error).toBeInstanceOf(MutationError);
    expect(error.code).toBe("INSUFFICIENT_FUNDS");
    expect(mockUpdatePaths).not.toHaveBeenCalled();
  });

  test("allows negative result when allowDebt: true", async () => {
    mockEnsure.mockResolvedValue(
      OkResult(makeUser({ _id: "user-1", currency: { coins: 30 } })),
    );

    // With allowDebt: true, the INSUFFICIENT_FUNDS check is skipped and the balance
    // is stored as-is (negative). This allows mod-applied deductions beyond current balance.
    const result = await adjustBalance("user-1", "coins", -50, { allowDebt: true });
    expect(result.isOk()).toBe(true);
    // 30 - 50 = -20 (stored as debt)
    expect(result.unwrap().newBalance).toBe(-20);
  });

  test("rejects invalid currency ID", async () => {
    const result = await adjustBalance("user-1", "INVALID!", 10);
    expect(result.isErr()).toBe(true);
    const error = result.error as InstanceType<typeof MutationError>;
    expect(error).toBeInstanceOf(MutationError);
    expect(error.code).toBe("INVALID_CURRENCY");
  });

  test("rejects zero delta", async () => {
    const result = await adjustBalance("user-1", "coins", 0);
    expect(result.isErr()).toBe(true);
    const error = result.error as InstanceType<typeof MutationError>;
    expect(error).toBeInstanceOf(MutationError);
    expect(error.code).toBe("INVALID_AMOUNT");
  });
});

// ---------------------------------------------------------------------------
// transfer
// ---------------------------------------------------------------------------

describe("transfer", () => {
  beforeEach(resetMocks);

  test("succeeds with correct debit and credit", async () => {
    // sender has 200 coins, recipient has 50
    mockGet
      .mockResolvedValueOnce(OkResult<User | null>(makeUser({ _id: "sender", currency: { coins: 200 } })))
      .mockResolvedValueOnce(OkResult<User | null>(makeUser({ _id: "recipient", currency: { coins: 50 } })));
    // ensure calls for adjustBalance
    mockEnsure
      .mockResolvedValueOnce(OkResult(makeUser({ _id: "sender", currency: { coins: 200 } })))
      .mockResolvedValueOnce(OkResult(makeUser({ _id: "recipient", currency: { coins: 50 } })));

    const result = await transfer("sender", "recipient", "coins", 100);
    expect(result.isOk()).toBe(true);
    const { senderBalance, recipientBalance } = result.unwrap();
    expect(senderBalance).toBe(100);
    expect(recipientBalance).toBe(150);
  });

  test("rejects self-transfer", async () => {
    const result = await transfer("user-1", "user-1", "coins", 50);
    expect(result.isErr()).toBe(true);
    const error = result.error as InstanceType<typeof MutationError>;
    expect(error).toBeInstanceOf(MutationError);
    expect(error.code).toBe("SELF_TRANSFER");
  });

  test("rejects when sender has insufficient funds", async () => {
    // sender has only 10 coins
    mockGet.mockResolvedValue(
      OkResult<User | null>(makeUser({ _id: "sender", currency: { coins: 10 } })),
    );

    const result = await transfer("sender", "recipient", "coins", 100);
    expect(result.isErr()).toBe(true);
    const error = result.error as InstanceType<typeof MutationError>;
    expect(error).toBeInstanceOf(MutationError);
    expect(error.code).toBe("INSUFFICIENT_FUNDS");
  });

  test("rejects invalid amount (zero)", async () => {
    const result = await transfer("sender", "recipient", "coins", 0);
    expect(result.isErr()).toBe(true);
    const error = result.error as InstanceType<typeof MutationError>;
    expect(error.code).toBe("INVALID_AMOUNT");
  });

  test("rejects invalid currency ID", async () => {
    const result = await transfer("sender", "recipient", "INVALID!", 50);
    expect(result.isErr()).toBe(true);
    const error = result.error as InstanceType<typeof MutationError>;
    expect(error.code).toBe("INVALID_CURRENCY");
  });
});
