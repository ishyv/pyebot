/**
 * Tests for currency mutations service.
 * Uses an in-memory Ctx stub — no real MongoDB required.
 */

import { describe, expect, it } from "bun:test";
import { EconomyAccount, UserCurrency } from "@/components/economy/wallet";
import { User } from "@/components/entities";
import type { EntityComponent } from "@/framework";
import type { Ctx } from "@/framework/types";
import { adjustBalance, getBalance, MutationError, transfer } from "./mutations";

// ---------------------------------------------------------------------------
// In-memory Ctx stub
// ---------------------------------------------------------------------------

type Wallet = {
  balances: Record<string, number>;
  bankBalances: Record<string, number>;
};
type Account = {
  status: "ok" | "blocked" | "banned";
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date;
  version: number;
  dailyStreak: number;
  lastDailyAt: Date | null;
};

type WalletMap = Map<string, Wallet>;
type AccountMap = Map<string, Account>;

function makeCtx(
  opts: {
    wallets?: Record<string, Record<string, number>>;
    accounts?: Record<string, "ok" | "blocked" | "banned">;
  } = {},
): Ctx {
  const wallets: WalletMap = new Map(
    Object.entries(opts.wallets ?? {}).map(([id, b]) => [id, { balances: b, bankBalances: {} }]),
  );
  const accounts: AccountMap = new Map(
    Object.entries(opts.accounts ?? {}).map(([id, status]) => [
      id,
      {
        status,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActivityAt: new Date(),
        version: 0,
        dailyStreak: 0,
        lastDailyAt: null,
      },
    ]),
  );

  function getWallet(id: string) {
    return wallets.get(id) ?? null;
  }
  function ensureWallet(id: string) {
    const existing = wallets.get(id);
    if (existing) return existing;
    const fresh = UserCurrency.schema.parse({});
    wallets.set(id, fresh);
    return fresh;
  }
  function getAccount(id: string) {
    return accounts.get(id) ?? null;
  }
  function ensureAccountDoc(id: string) {
    const existing = accounts.get(id);
    if (existing) return existing;
    const fresh = {
      status: "ok" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActivityAt: new Date(),
      version: 0,
      dailyStreak: 0,
      lastDailyAt: null,
    };
    accounts.set(id, fresh);
    return fresh;
  }

  function read<T>(id: string, component: EntityComponent<T>): T | null {
    if (component === UserCurrency) return getWallet(id) as T | null;
    if (component === EconomyAccount) return getAccount(id) as T | null;
    return null;
  }

  function ensure<T>(id: string, component: EntityComponent<T>): T {
    if (component === UserCurrency) return ensureWallet(id) as T;
    if (component === EconomyAccount) return ensureAccountDoc(id) as T;
    throw new Error("Unknown component in test ctx");
  }

  function update<T>(
    id: string,
    component: EntityComponent<T>,
    patchOrFn: Partial<T> | ((current: T) => Partial<T>),
  ) {
    const current = ensure(id, component);
    const delta = typeof patchOrFn === "function" ? patchOrFn(current) : patchOrFn;
    Object.assign(current as Record<string, unknown>, delta);
  }

  return {
    of(kind: typeof User, id: string) {
      if (kind !== User) throw new Error("Unknown entity kind in test ctx");
      return {
        async get<T>(component: EntityComponent<T>) {
          return ensure(id, component);
        },
        async peek<T>(component: EntityComponent<T>) {
          return read(id, component);
        },
        async update<T>(
          component: EntityComponent<T>,
          patchOrFn: Partial<T> | ((current: T) => Partial<T>),
        ) {
          update(id, component, patchOrFn);
        },
      };
    },
    async get() {
      return null;
    },
    async ensure() {
      throw new Error("legacy ensure should not be used in economy mutation tests");
    },
    async patch() {
      throw new Error("legacy patch should not be used in economy mutation tests");
    },
    async set() {},
    async delete() {},
    async query() {
      return [];
    },
    async emit() {},
    client: null,
    logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
    cooldowns: null,
    locks: null,
    sessions: null,
    interaction: null,
  } as unknown as Ctx;
}

// ---------------------------------------------------------------------------
// getBalance
// ---------------------------------------------------------------------------

describe("getBalance", () => {
  it("returns 0 for unknown user (no wallet)", async () => {
    const ctx = makeCtx();
    expect(await getBalance(ctx, "unknown", "coins")).toBe(0);
  });

  it("returns 0 when wallet exists but currency not set", async () => {
    const ctx = makeCtx({ wallets: { "user-1": {} } });
    expect(await getBalance(ctx, "user-1", "coins")).toBe(0);
  });

  it("returns correct balance when currency exists", async () => {
    const ctx = makeCtx({ wallets: { "user-1": { coins: 150 } } });
    expect(await getBalance(ctx, "user-1", "coins")).toBe(150);
  });
});

// ---------------------------------------------------------------------------
// adjustBalance
// ---------------------------------------------------------------------------

describe("adjustBalance", () => {
  it("credits balance by positive delta", async () => {
    const ctx = makeCtx({ wallets: { "user-1": { coins: 100 } } });
    const result = await adjustBalance(ctx, "user-1", "coins", 50);
    expect(result).toBe(150);
    expect(await getBalance(ctx, "user-1", "coins")).toBe(150);
  });

  it("debits balance by negative delta", async () => {
    const ctx = makeCtx({ wallets: { "user-1": { coins: 200 } } });
    const result = await adjustBalance(ctx, "user-1", "coins", -80);
    expect(result).toBe(120);
    expect(await getBalance(ctx, "user-1", "coins")).toBe(120);
  });

  it("throws INSUFFICIENT_FUNDS when result would go negative (default)", async () => {
    const ctx = makeCtx({ wallets: { "user-1": { coins: 30 } } });
    await expect(adjustBalance(ctx, "user-1", "coins", -50)).rejects.toMatchObject({
      name: "MutationError",
      code: "INSUFFICIENT_FUNDS",
    });
  });

  it("allows negative balance with allowDebt: true", async () => {
    const ctx = makeCtx({ wallets: { "user-1": { coins: 30 } } });
    const result = await adjustBalance(ctx, "user-1", "coins", -50, { allowDebt: true });
    expect(result).toBe(-20);
  });

  it("throws INVALID_AMOUNT on zero delta", async () => {
    const ctx = makeCtx();
    await expect(adjustBalance(ctx, "user-1", "coins", 0)).rejects.toMatchObject({
      code: "INVALID_AMOUNT",
    });
  });

  it("throws INVALID_CURRENCY for malformed ID", async () => {
    const ctx = makeCtx();
    await expect(adjustBalance(ctx, "user-1", "INVALID!", 10)).rejects.toMatchObject({
      code: "INVALID_CURRENCY",
    });
  });

  it("creates wallet if user has none", async () => {
    const ctx = makeCtx();
    const result = await adjustBalance(ctx, "new-user", "coins", 100);
    expect(result).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// transfer
// ---------------------------------------------------------------------------

describe("transfer", () => {
  it("debits sender and credits recipient", async () => {
    const ctx = makeCtx({
      wallets: { sender: { coins: 200 }, recipient: { coins: 50 } },
    });
    const { senderBalance, recipientBalance } = await transfer(
      ctx,
      "sender",
      "recipient",
      "coins",
      100,
    );
    expect(senderBalance).toBe(100);
    expect(recipientBalance).toBe(150);
  });

  it("throws SELF_TRANSFER", async () => {
    const ctx = makeCtx();
    await expect(transfer(ctx, "user-1", "user-1", "coins", 50)).rejects.toMatchObject({
      code: "SELF_TRANSFER",
    });
  });

  it("throws INVALID_AMOUNT for zero amount", async () => {
    const ctx = makeCtx();
    await expect(transfer(ctx, "a", "b", "coins", 0)).rejects.toMatchObject({
      code: "INVALID_AMOUNT",
    });
  });

  it("throws INVALID_CURRENCY", async () => {
    const ctx = makeCtx();
    await expect(transfer(ctx, "a", "b", "INVALID!", 50)).rejects.toMatchObject({
      code: "INVALID_CURRENCY",
    });
  });

  it("throws INSUFFICIENT_FUNDS when sender has too little", async () => {
    const ctx = makeCtx({ wallets: { sender: { coins: 10 } } });
    await expect(transfer(ctx, "sender", "recipient", "coins", 100)).rejects.toMatchObject({
      code: "INSUFFICIENT_FUNDS",
    });
  });

  it("throws ACCOUNT_INACTIVE for blocked sender", async () => {
    const ctx = makeCtx({
      wallets: { sender: { coins: 500 } },
      accounts: { sender: "blocked" },
    });
    await expect(transfer(ctx, "sender", "recipient", "coins", 100)).rejects.toMatchObject({
      code: "ACCOUNT_INACTIVE",
    });
  });

  it("exports MutationError class", () => {
    expect(new MutationError("INVALID_AMOUNT", "test")).toBeInstanceOf(MutationError);
  });
});
