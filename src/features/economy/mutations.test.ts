/**
 * Tests for currency mutations service.
 * Uses an in-memory Ctx stub — no real MongoDB required.
 */

import { describe, expect, it } from "bun:test";
import type { Ctx } from "@/framework/types";
import { UserCurrency } from "@/components/user-currency";
import { EconomyAccount } from "@/components/economy-account";
import { getBalance, adjustBalance, transfer, MutationError } from "./mutations";

// ---------------------------------------------------------------------------
// In-memory Ctx stub
// ---------------------------------------------------------------------------

type WalletMap = Map<string, { balances: Record<string, number> }>;
type AccountMap = Map<string, { status: string; createdAt: Date; updatedAt: Date; lastActivityAt: Date; version: number }>;

function makeCtx(opts: {
  wallets?: Record<string, Record<string, number>>;
  accounts?: Record<string, "ok" | "blocked" | "banned">;
} = {}): Ctx {
  const wallets: WalletMap = new Map(
    Object.entries(opts.wallets ?? {}).map(([id, b]) => [id, { balances: b }]),
  );
  const accounts: AccountMap = new Map(
    Object.entries(opts.accounts ?? {}).map(([id, status]) => [
      id,
      { status, createdAt: new Date(), updatedAt: new Date(), lastActivityAt: new Date(), version: 0 },
    ]),
  );

  function getWallet(id: string) { return wallets.get(id) ?? null; }
  function ensureWallet(id: string) {
    if (!wallets.has(id)) wallets.set(id, { balances: {} });
    return wallets.get(id)!;
  }
  function getAccount(id: string) { return accounts.get(id) ?? null; }
  function ensureAccountDoc(id: string) {
    if (!accounts.has(id)) {
      accounts.set(id, { status: "ok", createdAt: new Date(), updatedAt: new Date(), lastActivityAt: new Date(), version: 0 });
    }
    return accounts.get(id)!;
  }

  return {
    async get(id: string, component: unknown) {
      if (component === UserCurrency) return getWallet(id) as any;
      if (component === EconomyAccount) return getAccount(id) as any;
      return null;
    },
    async ensure(id: string, component: unknown) {
      if (component === UserCurrency) return ensureWallet(id) as any;
      if (component === EconomyAccount) return ensureAccountDoc(id) as any;
      throw new Error("Unknown component in test ctx");
    },
    async patch(id: string, component: unknown, patchOrFn: unknown) {
      if (component === UserCurrency) {
        const current = ensureWallet(id);
        const delta = typeof patchOrFn === "function" ? (patchOrFn as (v: typeof current) => Partial<typeof current>)(current) : patchOrFn as Partial<typeof current>;
        if (delta.balances) current.balances = delta.balances;
      } else if (component === EconomyAccount) {
        const current = ensureAccountDoc(id);
        const delta = typeof patchOrFn === "function" ? (patchOrFn as (v: typeof current) => Partial<typeof current>)(current) : patchOrFn as Partial<typeof current>;
        Object.assign(current, delta);
      }
    },
    async set() {},
    async delete() {},
    async query() { return []; },
    async emit() {},
    client: null as any,
    logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} } as any,
    cooldowns: null as any,
    locks: null as any,
    sessions: null as any,
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
    const { senderBalance, recipientBalance } = await transfer(ctx, "sender", "recipient", "coins", 100);
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
