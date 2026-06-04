/**
 * Tests for economy minigames (coinflip, trivia, rob).
 * Uses an in-memory Ctx stub — no real DB required.
 */

import { describe, expect, test } from "bun:test";
import { CooldownManager, SessionManager } from "@/core/state";
import {
  answerTrivia,
  coinflip,
  DEFAULT_COINFLIP_CONFIG,
  DEFAULT_ROB_CONFIG,
  rob,
  startTrivia,
} from "@/features/economy/minigames";
import type { Ctx } from "@/framework/types";

// ---------------------------------------------------------------------------
// In-memory Ctx factory
// ---------------------------------------------------------------------------

function makeCtx(
  opts: {
    wallets?: Record<string, Record<string, number>>;
    accounts?: Record<string, "ok" | "blocked" | "banned">;
  } = {},
): Ctx {
  const wallets: Record<string, Record<string, number>> = opts.wallets ?? {};
  const accounts: Record<string, "ok" | "blocked" | "banned"> = opts.accounts ?? {};
  const cooldowns = new CooldownManager();
  const sessions = new SessionManager<unknown>();

  return {
    cooldowns,
    sessions,
    locks: { acquire: () => true, release: () => {}, isLocked: () => false } as never,
    client: {} as never,
    logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} } as never,
    interaction: null,
    respond: {} as never,
    emit: async () => {},
    get: async (id, component) => {
      if (component.collection === "user_currencies") {
        const bal = wallets[id as string];
        if (!bal) return null;
        return { balances: bal, bankBalances: {} } as never;
      }
      if (component.collection === "economy_accounts") {
        const status = accounts[id as string];
        if (!status) return null;
        return {
          status,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastActivityAt: new Date(),
          version: 0,
          dailyStreak: 0,
          lastDailyAt: null,
        } as never;
      }
      return null;
    },
    ensure: async (id, component) => {
      if (component.collection === "user_currencies") {
        if (!wallets[id as string]) wallets[id as string] = {};
        return { balances: wallets[id as string], bankBalances: {} } as never;
      }
      if (component.collection === "economy_accounts") {
        if (!accounts[id as string]) accounts[id as string] = "ok";
        return {
          status: accounts[id as string],
          createdAt: new Date(),
          updatedAt: new Date(),
          lastActivityAt: new Date(),
          version: 0,
          dailyStreak: 0,
          lastDailyAt: null,
        } as never;
      }
      return {} as never;
    },
    patch: async (id, component, patchArg) => {
      if (component.collection === "user_currencies") {
        if (!wallets[id as string]) wallets[id as string] = {};
        const current = { balances: wallets[id as string], bankBalances: {} };
        const partial = (
          typeof patchArg === "function" ? patchArg(current as never) : patchArg
        ) as { balances?: Record<string, number> };
        if (partial.balances) {
          wallets[id as string] = partial.balances;
        }
      }
    },
    set: async () => {},
    delete: async () => {},
    query: async () => [],
    of: () => {
      throw new Error("entity API not used in this mock");
    },
    select: () => {
      throw new Error("entity API not used in this mock");
    },
    transaction: () => {
      throw new Error("entity API not used in this mock");
    },
  } as Ctx;
}

// ---------------------------------------------------------------------------
// coinflip
// ---------------------------------------------------------------------------

describe("coinflip", () => {
  test("throws BET_TOO_LOW when bet is below minimum", async () => {
    const ctx = makeCtx({ wallets: { u1: { coins: 1000 } }, accounts: { u1: "ok" } });
    await expect(
      coinflip(ctx, "u1", "heads", DEFAULT_COINFLIP_CONFIG.minBet - 1),
    ).rejects.toMatchObject({ code: "BET_TOO_LOW" });
  });

  test("throws BET_TOO_HIGH when bet exceeds maximum", async () => {
    const ctx = makeCtx({ wallets: { u1: { coins: 99999 } }, accounts: { u1: "ok" } });
    await expect(
      coinflip(ctx, "u1", "heads", DEFAULT_COINFLIP_CONFIG.maxBet + 1),
    ).rejects.toMatchObject({ code: "BET_TOO_HIGH" });
  });

  test("throws INSUFFICIENT_FUNDS when balance too low", async () => {
    const ctx = makeCtx({ wallets: { u1: { coins: 1 } }, accounts: { u1: "ok" } });
    await expect(coinflip(ctx, "u1", "heads", 100)).rejects.toMatchObject({
      code: "INSUFFICIENT_FUNDS",
    });
  });

  test("throws ACCOUNT_INACTIVE for blocked account", async () => {
    const ctx = makeCtx({ wallets: { u1: { coins: 1000 } }, accounts: { u1: "blocked" } });
    await expect(coinflip(ctx, "u1", "heads", 50)).rejects.toMatchObject({
      code: "ACCOUNT_INACTIVE",
    });
  });

  test("throws COOLDOWN_ACTIVE when on cooldown", async () => {
    const ctx = makeCtx({ wallets: { u1: { coins: 1000 } }, accounts: { u1: "ok" } });
    ctx.cooldowns.set("u1", "coinflip", 60_000);
    await expect(coinflip(ctx, "u1", "heads", 50)).rejects.toMatchObject({
      code: "COOLDOWN_ACTIVE",
    });
  });

  test("returns a result with correct shape on valid bet", async () => {
    const ctx = makeCtx({ wallets: { u1: { coins: 1000 } }, accounts: { u1: "ok" } });
    const result = await coinflip(ctx, "u1", "heads", 50);
    expect(result).toMatchObject({
      choice: "heads",
      betAmount: 50,
    });
    expect(["heads", "tails"]).toContain(result.outcome);
  });
});

// ---------------------------------------------------------------------------
// startTrivia / answerTrivia
// ---------------------------------------------------------------------------

describe("startTrivia + answerTrivia", () => {
  test("starts a trivia session and stores it", async () => {
    const ctx = makeCtx({ accounts: { u1: "ok" } });
    const result = await startTrivia(ctx, "u1", "g1");
    expect(result.sessionKey).toBe("u1:g1");
    expect(result.question).toBeDefined();
    expect(result.timeoutMs).toBeGreaterThan(0);
  });

  test("throws COOLDOWN_ACTIVE when trivia is on cooldown", async () => {
    const ctx = makeCtx({ accounts: { u1: "ok" } });
    ctx.cooldowns.set("u1", "trivia", 60_000);
    await expect(startTrivia(ctx, "u1", "g1")).rejects.toMatchObject({ code: "COOLDOWN_ACTIVE" });
  });

  test("answerTrivia awards coins on correct answer", async () => {
    const ctx = makeCtx({ wallets: { u1: { coins: 100 } }, accounts: { u1: "ok" } });
    const { sessionKey, question } = await startTrivia(ctx, "u1", "g1", { baseReward: 10 });
    const result = await answerTrivia(ctx, sessionKey, question.correctIndex);
    expect(result.correct).toBe(true);
    expect(result.reward).toBeGreaterThan(0);
  });

  test("answerTrivia returns correct=false on wrong answer", async () => {
    const ctx = makeCtx({ wallets: { u1: { coins: 100 } }, accounts: { u1: "ok" } });
    const { sessionKey, question } = await startTrivia(ctx, "u1", "g1");
    const wrongIndex = (question.correctIndex + 1) % question.options.length;
    const result = await answerTrivia(ctx, sessionKey, wrongIndex);
    expect(result.correct).toBe(false);
    expect(result.reward).toBe(0);
  });

  test("throws SESSION_NOT_FOUND for unknown session", async () => {
    const ctx = makeCtx();
    await expect(answerTrivia(ctx, "nonexistent:key", 0)).rejects.toMatchObject({
      code: "SESSION_NOT_FOUND",
    });
  });
});

// ---------------------------------------------------------------------------
// rob
// ---------------------------------------------------------------------------

describe("rob", () => {
  test("throws INVALID_INPUT when robbing yourself", async () => {
    const ctx = makeCtx({ wallets: { u1: { coins: 1000 } }, accounts: { u1: "ok" } });
    await expect(rob(ctx, "u1", "u1")).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  test("throws TARGET_INSUFFICIENT_FUNDS when target too poor", async () => {
    const ctx = makeCtx({
      wallets: { u1: { coins: 1000 }, u2: { coins: 1 } },
      accounts: { u1: "ok", u2: "ok" },
    });
    await expect(rob(ctx, "u1", "u2")).rejects.toMatchObject({ code: "TARGET_INSUFFICIENT_FUNDS" });
  });

  test("throws COOLDOWN_ACTIVE when robber is on cooldown", async () => {
    const ctx = makeCtx({
      wallets: { u1: { coins: 1000 }, u2: { coins: 500 } },
      accounts: { u1: "ok", u2: "ok" },
    });
    ctx.cooldowns.set("u1", "rob", 60_000);
    await expect(rob(ctx, "u1", "u2")).rejects.toMatchObject({ code: "COOLDOWN_ACTIVE" });
  });

  test("returns a rob result with expected shape", async () => {
    const ctx = makeCtx({
      wallets: { u1: { coins: 1000 }, u2: { coins: DEFAULT_ROB_CONFIG.minTargetBalance + 100 } },
      accounts: { u1: "ok", u2: "ok" },
    });
    const result = await rob(ctx, "u1", "u2");
    expect(result).toHaveProperty("success");
    expect(typeof result.stolenAmount).toBe("number");
    expect(typeof result.fineAmount).toBe("number");
  });
});
