/**
 * Currency mutations service.
 *
 * All functions accept `ctx: Ctx` — the single data-access surface — rather than
 * importing repository functions directly. Failures throw `MutationError` so
 * callers can catch typed domain errors. DB failures propagate as untyped errors
 * caught at the interaction boundary.
 */

import { EconomyAccount, UserCurrency } from "@/components/economy/wallet";
import { User } from "@/components/entities";
import type { Ctx } from "@/framework/types";

export class MutationError extends Error {
  constructor(
    public readonly code:
      | "INSUFFICIENT_FUNDS"
      | "INVALID_AMOUNT"
      | "SELF_TRANSFER"
      | "INVALID_CURRENCY"
      | "ACCOUNT_INACTIVE",
    message: string,
  ) {
    super(message);
    this.name = "MutationError";
  }
}

/** Read a user's balance for a currency. Returns 0 when no wallet document exists. */
export async function getBalance(ctx: Ctx, userId: string, currencyId: string): Promise<number> {
  const wallet = await ctx.of(User, userId).peek(UserCurrency);
  return wallet?.balances[currencyId] ?? 0;
}

/**
 * Adjust a user's balance by delta (positive to credit, negative to debit).
 * Returns the new balance. Throws MutationError on domain failure.
 */
export async function adjustBalance(
  ctx: Ctx,
  userId: string,
  currencyId: string,
  delta: number,
  options?: { allowDebt?: boolean },
): Promise<number> {
  if (delta === 0) throw new MutationError("INVALID_AMOUNT", "Delta must be non-zero");
  if (!/^[a-z][a-z0-9_]*$/.test(currencyId)) {
    throw new MutationError("INVALID_CURRENCY", `Invalid currency ID: "${currencyId}"`);
  }

  const wallet = await ctx.of(User, userId).get(UserCurrency);
  const current = wallet.balances[currencyId] ?? 0;
  const next = current + delta;

  if (!options?.allowDebt && next < 0) {
    throw new MutationError(
      "INSUFFICIENT_FUNDS",
      `Insufficient funds: balance is ${current}, attempted to adjust by ${delta}`,
    );
  }

  const final = options?.allowDebt ? next : Math.max(next, 0);
  await ctx.of(User, userId).update(UserCurrency, (w) => ({
    balances: { ...w.balances, [currencyId]: final },
  }));
  return final;
}

/** Read a user's bank balance for a currency. Returns 0 when no wallet document exists. */
export async function getBankBalance(
  ctx: Ctx,
  userId: string,
  currencyId: string,
): Promise<number> {
  const wallet = await ctx.of(User, userId).peek(UserCurrency);
  return wallet?.bankBalances[currencyId] ?? 0;
}

/**
 * Move funds from wallet to bank. Returns new hand and bank balances.
 * Throws MutationError on domain failure.
 */
export async function deposit(
  ctx: Ctx,
  userId: string,
  currencyId: string,
  amount: number,
): Promise<{ handBalance: number; bankBalance: number }> {
  if (amount <= 0) throw new MutationError("INVALID_AMOUNT", "Deposit amount must be positive");
  const wallet = await ctx.of(User, userId).get(UserCurrency);
  const hand = wallet.balances[currencyId] ?? 0;
  if (hand < amount) {
    throw new MutationError("INSUFFICIENT_FUNDS", `Insufficient funds: balance is ${hand}`);
  }
  const handBalance = hand - amount;
  const bankBalance = (wallet.bankBalances[currencyId] ?? 0) + amount;
  await ctx.of(User, userId).update(UserCurrency, (w) => ({
    balances: { ...w.balances, [currencyId]: handBalance },
    bankBalances: { ...w.bankBalances, [currencyId]: bankBalance },
  }));
  return { handBalance, bankBalance };
}

/**
 * Move funds from bank to wallet. Returns new hand and bank balances.
 * Throws MutationError on domain failure.
 */
export async function withdraw(
  ctx: Ctx,
  userId: string,
  currencyId: string,
  amount: number,
): Promise<{ handBalance: number; bankBalance: number }> {
  if (amount <= 0) throw new MutationError("INVALID_AMOUNT", "Withdrawal amount must be positive");
  const wallet = await ctx.of(User, userId).get(UserCurrency);
  const bank = wallet.bankBalances[currencyId] ?? 0;
  if (bank < amount) {
    throw new MutationError("INSUFFICIENT_FUNDS", `Insufficient bank funds: balance is ${bank}`);
  }
  const bankBalance = bank - amount;
  const handBalance = (wallet.balances[currencyId] ?? 0) + amount;
  await ctx.of(User, userId).update(UserCurrency, (w) => ({
    balances: { ...w.balances, [currencyId]: handBalance },
    bankBalances: { ...w.bankBalances, [currencyId]: bankBalance },
  }));
  return { handBalance, bankBalance };
}

/**
 * Transfer currency from sender to recipient. Returns new balances on success.
 * Throws MutationError on any domain failure. If recipient credit fails after
 * sender debit, the debit is rolled back on a best-effort basis. Full
 * cross-document atomicity still requires MongoDB transactions.
 */
export async function transfer(
  ctx: Ctx,
  senderId: string,
  recipientId: string,
  currencyId: string,
  amount: number,
): Promise<{ senderBalance: number; recipientBalance: number }> {
  if (amount <= 0)
    throw new MutationError("INVALID_AMOUNT", "Transfer amount must be greater than 0");
  if (senderId === recipientId)
    throw new MutationError("SELF_TRANSFER", "Cannot transfer currency to yourself");
  if (!/^[a-z][a-z0-9_]*$/.test(currencyId)) {
    throw new MutationError("INVALID_CURRENCY", `Invalid currency ID: "${currencyId}"`);
  }

  const [senderAccount, recipientAccount] = await Promise.all([
    ctx.of(User, senderId).get(EconomyAccount),
    ctx.of(User, recipientId).get(EconomyAccount),
  ]);
  if (senderAccount.status !== "ok")
    throw new MutationError("ACCOUNT_INACTIVE", "Sender account is not active");
  if (recipientAccount.status !== "ok")
    throw new MutationError("ACCOUNT_INACTIVE", "Recipient account is not active");

  const senderWallet = await ctx.of(User, senderId).get(UserCurrency);
  const senderCurrent = senderWallet.balances[currencyId] ?? 0;
  if (senderCurrent < amount) {
    throw new MutationError(
      "INSUFFICIENT_FUNDS",
      `Sender has insufficient funds: balance is ${senderCurrent}, attempted to transfer ${amount}`,
    );
  }

  const senderBalance = await adjustBalance(ctx, senderId, currencyId, -amount);
  let recipientBalance: number;
  try {
    recipientBalance = await adjustBalance(ctx, recipientId, currencyId, +amount);
  } catch (error) {
    await adjustBalance(ctx, senderId, currencyId, amount, { allowDebt: true }).catch(
      (rollback) => {
        ctx.logger.error("Failed to roll back economy transfer debit", rollback);
      },
    );
    throw error;
  }
  return { senderBalance, recipientBalance };
}
