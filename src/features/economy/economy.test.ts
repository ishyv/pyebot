/**
 * Tests for economy account module.
 * Mocks the db layer — no real MongoDB required.
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
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock userStore BEFORE importing account module
// ---------------------------------------------------------------------------

const mockGet = mock(async (_id: string) => OkResult<User | null>(null));
const mockEnsure = mock(async (_id: string) => OkResult(makeUser()));
const mockPatch = mock(async (_id: string, _patch: Partial<User>) =>
  OkResult(makeUser()),
);
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
    patch: mockPatch,
    updatePaths: mockUpdatePaths,
  },
}));

// Import AFTER mocking
const { isAccountActive, getAccount, ensureAccount } = await import(
  "./account"
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = new Date("2026-01-01T00:00:00.000Z");

function makeEconomyAccount() {
  return {
    status: "ok" as const,
    createdAt: NOW,
    updatedAt: NOW,
    lastActivityAt: NOW,
    version: 0,
  };
}

// ---------------------------------------------------------------------------
// Pure / sync tests
// ---------------------------------------------------------------------------

describe("isAccountActive", () => {
  test('returns true for "ok"', () => {
    expect(isAccountActive("ok")).toBe(true);
  });

  test('returns false for "blocked"', () => {
    expect(isAccountActive("blocked")).toBe(false);
  });

  test('returns false for "banned"', () => {
    expect(isAccountActive("banned")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getAccount
// ---------------------------------------------------------------------------

describe("getAccount", () => {
  beforeEach(() => {
    mockGet.mockClear();
    mockEnsure.mockClear();
    mockPatch.mockClear();
  });

  test("returns null when user not found", async () => {
    mockGet.mockImplementation(async () => OkResult<User | null>(null));

    const result = await getAccount("user-missing");
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBeNull();
  });

  test("returns null when user has no economyAccount field", async () => {
    mockGet.mockImplementation(async () =>
      OkResult<User | null>(makeUser({ _id: "user-1" })),
    );

    const result = await getAccount("user-1");
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBeNull();
  });

  test("returns parsed account when economyAccount is present", async () => {
    const accountData = makeEconomyAccount();
    mockGet.mockImplementation(async () =>
      OkResult<User | null>(
        makeUser({ _id: "user-1", economyAccount: accountData }),
      ),
    );

    const result = await getAccount("user-1");
    expect(result.isOk()).toBe(true);
    const account = result.unwrap();
    expect(account).not.toBeNull();
    expect(account!.userId).toBe("user-1");
    expect(account!.status).toBe("ok");
    expect(account!.version).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// ensureAccount
// ---------------------------------------------------------------------------

describe("ensureAccount", () => {
  beforeEach(() => {
    mockGet.mockClear();
    mockEnsure.mockClear();
    mockPatch.mockClear();
  });

  test("returns existing account (isNew: false) when already initialized", async () => {
    const accountData = makeEconomyAccount();
    const user = makeUser({ _id: "user-2", economyAccount: accountData });
    mockEnsure.mockImplementation(async () => OkResult(user));

    const result = await ensureAccount("user-2");
    expect(result.isOk()).toBe(true);
    const { account, isNew } = result.unwrap();
    expect(isNew).toBe(false);
    expect(account.userId).toBe("user-2");
    expect(account.status).toBe("ok");
  });

  test("creates new account (isNew: true) when missing", async () => {
    // ensure returns user without economyAccount
    const user = makeUser({ _id: "user-3" });
    mockEnsure.mockImplementation(async () => OkResult(user));

    // patch returns user WITH economyAccount set
    const patchedUser = makeUser({
      _id: "user-3",
      economyAccount: makeEconomyAccount(),
    });
    mockPatch.mockImplementation(async () => OkResult(patchedUser));

    const result = await ensureAccount("user-3");
    expect(result.isOk()).toBe(true);
    const { account, isNew } = result.unwrap();
    expect(isNew).toBe(true);
    expect(account.userId).toBe("user-3");
    expect(account.status).toBe("ok");
  });
});
