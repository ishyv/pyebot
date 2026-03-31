/**
 * Currency mutations service.
 *
 * Purpose: Read/write user currency balances.
 * Architecture: Plain exported async functions — no classes (except MutationError).
 * Dependencies: userStore, economy account module, currency schema validators.
 *
 * Invariants:
 * - All async functions that can fail return Result<T, Error>.
 * - adjustBalance uses a read-modify-write pattern. This is NOT atomic:
 *   concurrent writes may race. A future version should use MongoDB $inc
 *   via a custom updateOne call or a pipeline to avoid this.
 * - transfer uses two separate adjustBalance calls (best-effort, not transactional).
 *   Full atomicity requires a MongoDB replica set with multi-document transactions.
 */

import { OkResult, ErrResult, type Result } from "@/core/result";
import { userStore } from "@/db/repositories/users";
import { ensureAccount, isAccountActive } from "@/features/economy/account";
import { isValidCurrencyId } from "@/db/schemas/currency";

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class MutationError extends Error {
  constructor(
    public readonly code:
      | "INSUFFICIENT_FUNDS"
      | "INVALID_AMOUNT"
      | "SELF_TRANSFER"
      | "INVALID_CURRENCY"
      | "UPDATE_FAILED"
      | "TRANSFER_PARTIAL_FAILURE",
    message: string,
  ) {
    super(message);
    this.name = "MutationError";
  }
}

// ---------------------------------------------------------------------------
// getBalance
// ---------------------------------------------------------------------------

/**
 * Get a user's balance for a currency. Returns 0 if account/currency doesn't exist.
 */
export async function getBalance(
  userId: string,
  currencyId: string,
): Promise<Result<number, Error>> {
  const userRes = await userStore.get(userId);
  if (userRes.isErr()) return ErrResult(userRes.error);
  const user = userRes.unwrap();
  if (!user) return OkResult(0);
  return OkResult(user.currency[currencyId] ?? 0);
}

// ---------------------------------------------------------------------------
// adjustBalance
// ---------------------------------------------------------------------------

/**
 * Adjust a user's currency balance by delta (can be negative).
 * Ensures the result won't go below 0 unless allowDebt is true.
 *
 * NOTE: This uses a read-modify-write pattern and is NOT atomic.
 * Concurrent adjustments may race. A future version should use MongoDB
 * $inc with a conditional update to avoid this limitation.
 *
 * Returns the new balance.
 */
export async function adjustBalance(
  userId: string,
  currencyId: string,
  delta: number,
  options?: { allowDebt?: boolean },
): Promise<Result<{ newBalance: number }, Error>> {
  if (delta === 0) {
    return ErrResult(
      new MutationError("INVALID_AMOUNT", "Delta must be non-zero"),
    );
  }

  if (!isValidCurrencyId(currencyId)) {
    return ErrResult(
      new MutationError(
        "INVALID_CURRENCY",
        `Invalid currency ID: "${currencyId}"`,
      ),
    );
  }

  // Ensure user document exists before reading balance
  const ensureRes = await userStore.ensure(userId);
  if (ensureRes.isErr()) return ErrResult(ensureRes.error);
  const user = ensureRes.unwrap();

  const currentBalance = user.currency[currencyId] ?? 0;
  const newBalance = currentBalance + delta;

  if (!options?.allowDebt && newBalance < 0) {
    return ErrResult(
      new MutationError(
        "INSUFFICIENT_FUNDS",
        `Insufficient funds: balance is ${currentBalance}, attempted to adjust by ${delta}`,
      ),
    );
  }

  // allowDebt permits negative balances (e.g. mod-applied deductions)
  const finalBalance = options?.allowDebt ? newBalance : Math.max(newBalance, 0);
  const updateRes = await userStore.updatePaths(userId, {
    [`currency.${currencyId}`]: finalBalance,
  });

  if (updateRes.isErr()) {
    return ErrResult(
      new MutationError("UPDATE_FAILED", `Failed to update balance: ${updateRes.error.message}`),
    );
  }

  return OkResult({ newBalance: finalBalance });
}

// ---------------------------------------------------------------------------
// getBank / deposit / withdraw
// ---------------------------------------------------------------------------

/**
 * Get a user's bank balance for a currency. Returns 0 if not set.
 */
export async function getBankBalance(
  userId: string,
  currencyId: string,
): Promise<Result<number, Error>> {
  const userRes = await userStore.get(userId);
  if (userRes.isErr()) return ErrResult(userRes.error);
  const user = userRes.unwrap();
  if (!user) return OkResult(0);
  const bank = (user as Record<string, unknown> & { bank?: Record<string, number> }).bank ?? {};
  return OkResult(bank[currencyId] ?? 0);
}

/**
 * Move coins from hand (currency) to bank.
 */
export async function deposit(
  userId: string,
  currencyId: string,
  amount: number,
): Promise<Result<{ handBalance: number; bankBalance: number }, Error>> {
  if (amount <= 0) {
    return ErrResult(new MutationError("INVALID_AMOUNT", "Deposit amount must be greater than 0"));
  }
  if (!isValidCurrencyId(currencyId)) {
    return ErrResult(new MutationError("INVALID_CURRENCY", `Invalid currency: "${currencyId}"`));
  }

  const ensureRes = await userStore.ensure(userId);
  if (ensureRes.isErr()) return ErrResult(ensureRes.error);
  const user = ensureRes.unwrap();

  const handBalance = user.currency[currencyId] ?? 0;
  if (handBalance < amount) {
    return ErrResult(
      new MutationError("INSUFFICIENT_FUNDS", `Insufficient hand balance: ${handBalance}`),
    );
  }

  const bank = (user as Record<string, unknown> & { bank?: Record<string, number> }).bank ?? {};
  const currentBank = bank[currencyId] ?? 0;
  const newHand = handBalance - amount;
  const newBank = currentBank + amount;

  const updateRes = await userStore.updatePaths(userId, {
    [`currency.${currencyId}`]: newHand,
    [`bank.${currencyId}`]: newBank,
  });

  if (updateRes.isErr()) {
    return ErrResult(new MutationError("UPDATE_FAILED", updateRes.error.message));
  }

  return OkResult({ handBalance: newHand, bankBalance: newBank });
}

/**
 * Move coins from bank to hand (currency).
 */
export async function withdraw(
  userId: string,
  currencyId: string,
  amount: number,
): Promise<Result<{ handBalance: number; bankBalance: number }, Error>> {
  if (amount <= 0) {
    return ErrResult(new MutationError("INVALID_AMOUNT", "Withdrawal amount must be greater than 0"));
  }
  if (!isValidCurrencyId(currencyId)) {
    return ErrResult(new MutationError("INVALID_CURRENCY", `Invalid currency: "${currencyId}"`));
  }

  const ensureRes = await userStore.ensure(userId);
  if (ensureRes.isErr()) return ErrResult(ensureRes.error);
  const user = ensureRes.unwrap();

  const bank = (user as Record<string, unknown> & { bank?: Record<string, number> }).bank ?? {};
  const bankBalance = bank[currencyId] ?? 0;
  if (bankBalance < amount) {
    return ErrResult(
      new MutationError("INSUFFICIENT_FUNDS", `Insufficient bank balance: ${bankBalance}`),
    );
  }

  const currentHand = user.currency[currencyId] ?? 0;
  const newHand = currentHand + amount;
  const newBank = bankBalance - amount;

  const updateRes = await userStore.updatePaths(userId, {
    [`currency.${currencyId}`]: newHand,
    [`bank.${currencyId}`]: newBank,
  });

  if (updateRes.isErr()) {
    return ErrResult(new MutationError("UPDATE_FAILED", updateRes.error.message));
  }

  return OkResult({ handBalance: newHand, bankBalance: newBank });
}

// ---------------------------------------------------------------------------
// transfer
// ---------------------------------------------------------------------------

/**
 * Transfer currency from sender to recipient.
 * Validates sender has sufficient funds.
 * Debits sender atomically, credits recipient atomically.
 * On recipient credit failure: attempts best-effort rollback of sender debit.
 *
 * NOTE: Full atomicity requires MongoDB replica set transactions.
 * This implementation uses two atomic $set operations (best-effort).
 * A future version should use multi-document transactions.
 */
export async function transfer(
  senderId: string,
  recipientId: string,
  currencyId: string,
  amount: number,
): Promise<Result<{ senderBalance: number; recipientBalance: number }, Error>> {
  if (amount <= 0) {
    return ErrResult(
      new MutationError("INVALID_AMOUNT", "Transfer amount must be greater than 0"),
    );
  }

  if (senderId === recipientId) {
    return ErrResult(
      new MutationError("SELF_TRANSFER", "Cannot transfer currency to yourself"),
    );
  }

  if (!isValidCurrencyId(currencyId)) {
    return ErrResult(
      new MutationError("INVALID_CURRENCY", `Invalid currency ID: "${currencyId}"`),
    );
  }

  // Ensure both accounts exist and are active
  const senderRes = await ensureAccount(senderId);
  if (senderRes.isErr()) return ErrResult(senderRes.error);
  const { account: senderAccount } = senderRes.unwrap();

  if (!isAccountActive(senderAccount.status)) {
    return ErrResult(
      new MutationError("UPDATE_FAILED", "Sender account is not active"),
    );
  }

  const recipientRes = await ensureAccount(recipientId);
  if (recipientRes.isErr()) return ErrResult(recipientRes.error);
  const { account: recipientAccount } = recipientRes.unwrap();

  if (!isAccountActive(recipientAccount.status)) {
    return ErrResult(
      new MutationError("UPDATE_FAILED", "Recipient account is not active"),
    );
  }

  // Check sender has sufficient funds
  const senderBalRes = await getBalance(senderId, currencyId);
  if (senderBalRes.isErr()) return ErrResult(senderBalRes.error);
  const senderCurrentBalance = senderBalRes.unwrap();

  if (senderCurrentBalance < amount) {
    return ErrResult(
      new MutationError(
        "INSUFFICIENT_FUNDS",
        `Sender has insufficient funds: balance is ${senderCurrentBalance}, attempted to transfer ${amount}`,
      ),
    );
  }

  // Debit sender
  const debitRes = await adjustBalance(senderId, currencyId, -amount);
  if (debitRes.isErr()) return ErrResult(debitRes.error);
  const { newBalance: senderBalance } = debitRes.unwrap();

  // Credit recipient
  const creditRes = await adjustBalance(recipientId, currencyId, +amount);
  if (creditRes.isErr()) {
    // Attempt best-effort rollback of sender debit
    await adjustBalance(senderId, currencyId, +amount);
    return ErrResult(
      new MutationError(
        "TRANSFER_PARTIAL_FAILURE",
        `Credited recipient failed; attempted rollback. Original error: ${creditRes.error.message}`,
      ),
    );
  }
  const { newBalance: recipientBalance } = creditRes.unwrap();

  return OkResult({ senderBalance, recipientBalance });
}
