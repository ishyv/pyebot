/**
 * Economy minigames: coinflip, trivia, rob.
 *
 * Architecture: Plain exported async functions — no classes (except MinigameError).
 * Dependencies: cooldowns/sessions from core/state, getBalance/adjustBalance from mutations,
 *   ensureAccount/isAccountActive from account.
 */

import { OkResult, ErrResult, type Result } from "@/core/result";
import { cooldowns, sessions } from "@/core/state";
import { getBalance, adjustBalance } from "@/features/economy/mutations";
import { ensureAccount, isAccountActive } from "@/features/economy/account";

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class MinigameError extends Error {
  constructor(
    public readonly code:
      | "INVALID_CHOICE"
      | "BET_TOO_LOW"
      | "BET_TOO_HIGH"
      | "INSUFFICIENT_FUNDS"
      | "COOLDOWN_ACTIVE"
      | "ACCOUNT_INACTIVE"
      | "INVALID_INPUT"
      | "SESSION_NOT_FOUND"
      | "SESSION_EXPIRED"
      | "TARGET_INSUFFICIENT_FUNDS",
    message: string,
  ) {
    super(message);
    this.name = "MinigameError";
  }
}

// ---------------------------------------------------------------------------
// Coinflip types
// ---------------------------------------------------------------------------

export interface CoinflipConfig {
  readonly minBet: number;
  readonly maxBet: number;
  readonly houseEdge: number;
  readonly cooldownMs: number;
  readonly currencyId: string;
}

export const DEFAULT_COINFLIP_CONFIG: CoinflipConfig = {
  minBet: 5,
  maxBet: 500,
  houseEdge: 0.05,
  cooldownMs: 10_000,
  currencyId: "coins",
};

export interface CoinflipResult {
  readonly outcome: "heads" | "tails";
  readonly choice: "heads" | "tails";
  readonly won: boolean;
  readonly betAmount: number;
  readonly winnings: number;
  readonly newBalance: number;
}

// ---------------------------------------------------------------------------
// Trivia types
// ---------------------------------------------------------------------------

export interface TriviaQuestion {
  readonly id: string;
  readonly question: string;
  readonly options: readonly string[];
  readonly correctIndex: number;
  readonly category: string;
  readonly difficulty: 1 | 2 | 3;
}

export interface TriviaSession {
  readonly questionId: string;
  readonly userId: string;
  readonly guildId: string;
  readonly startedAt: number;
  readonly currencyId: string;
  readonly baseReward: number;
  readonly difficulty: 1 | 2 | 3;
}

export interface TriviaStartResult {
  readonly sessionKey: string;
  readonly question: TriviaQuestion;
  readonly timeoutMs: number;
}

export interface TriviaAnswerResult {
  readonly correct: boolean;
  readonly correctIndex: number;
  readonly reward: number;
  readonly newBalance: number;
}

// ---------------------------------------------------------------------------
// Rob types
// ---------------------------------------------------------------------------

export interface RobConfig {
  readonly cooldownMs: number;
  readonly pairCooldownMs: number;
  readonly maxStealPct: number;
  readonly maxStealAmount: number;
  readonly minTargetBalance: number;
  readonly failChance: number;
  readonly failFinePct: number;
  readonly failFineMin: number;
  readonly currencyId: string;
}

export const DEFAULT_ROB_CONFIG: RobConfig = {
  cooldownMs: 5 * 60 * 1000,
  pairCooldownMs: 60 * 60 * 1000,
  maxStealPct: 0.15,
  maxStealAmount: 500,
  minTargetBalance: 50,
  failChance: 0.35,
  failFinePct: 0.2,
  failFineMin: 5,
  currencyId: "coins",
};

export interface RobResult {
  readonly success: boolean;
  readonly stolenAmount: number;
  readonly fineAmount: number;
  readonly robberNewBalance: number;
  readonly targetNewBalance: number;
}

// ---------------------------------------------------------------------------
// Trivia question bank
// ---------------------------------------------------------------------------

const TRIVIA_QUESTIONS: TriviaQuestion[] = [
  { id: "q1", question: "What is 2 + 2?", options: ["3", "4", "5", "6"], correctIndex: 1, category: "math", difficulty: 1 },
  { id: "q2", question: "What color is the sky on a clear day?", options: ["Green", "Blue", "Red", "Yellow"], correctIndex: 1, category: "general", difficulty: 1 },
  { id: "q3", question: "How many sides does a triangle have?", options: ["2", "3", "4", "5"], correctIndex: 1, category: "math", difficulty: 1 },
  { id: "q4", question: "What is the capital of France?", options: ["London", "Berlin", "Paris", "Rome"], correctIndex: 2, category: "geography", difficulty: 1 },
  { id: "q5", question: "What is 7 * 8?", options: ["54", "56", "58", "60"], correctIndex: 1, category: "math", difficulty: 2 },
  { id: "q6", question: "How many planets are in our solar system?", options: ["7", "8", "9", "10"], correctIndex: 1, category: "science", difficulty: 2 },
  { id: "q7", question: "What is the chemical symbol for water?", options: ["O2", "CO2", "H2O", "HO"], correctIndex: 2, category: "science", difficulty: 2 },
  { id: "q8", question: "Who wrote Romeo and Juliet?", options: ["Dickens", "Tolkien", "Shakespeare", "Austen"], correctIndex: 2, category: "literature", difficulty: 2 },
  { id: "q9", question: "What is the square root of 144?", options: ["10", "11", "12", "13"], correctIndex: 2, category: "math", difficulty: 2 },
  { id: "q10", question: "What year did World War II end?", options: ["1943", "1944", "1945", "1946"], correctIndex: 2, category: "history", difficulty: 2 },
  { id: "q11", question: "What is the largest ocean on Earth?", options: ["Atlantic", "Indian", "Arctic", "Pacific"], correctIndex: 3, category: "geography", difficulty: 1 },
  { id: "q12", question: "How many bones are in the adult human body?", options: ["196", "206", "216", "226"], correctIndex: 1, category: "science", difficulty: 3 },
  { id: "q13", question: "What is the speed of light in km/s (approx)?", options: ["200,000", "300,000", "400,000", "500,000"], correctIndex: 1, category: "science", difficulty: 3 },
  { id: "q14", question: "In what year was the Eiffel Tower built?", options: ["1879", "1885", "1889", "1895"], correctIndex: 2, category: "history", difficulty: 3 },
  { id: "q15", question: "What is the atomic number of gold?", options: ["47", "72", "79", "83"], correctIndex: 2, category: "science", difficulty: 3 },
];

// ---------------------------------------------------------------------------
// coinflip
// ---------------------------------------------------------------------------

export async function coinflip(
  userId: string,
  choice: "heads" | "tails",
  betAmount: number,
  config?: Partial<CoinflipConfig>,
): Promise<Result<CoinflipResult, MinigameError>> {
  const cfg: CoinflipConfig = { ...DEFAULT_COINFLIP_CONFIG, ...config };

  if (choice !== "heads" && choice !== "tails") {
    return ErrResult(new MinigameError("INVALID_CHOICE", 'Choice must be "heads" or "tails"'));
  }

  if (!Number.isInteger(betAmount) || betAmount < cfg.minBet) {
    return ErrResult(new MinigameError("BET_TOO_LOW", `Bet must be at least ${cfg.minBet}`));
  }

  if (betAmount > cfg.maxBet) {
    return ErrResult(new MinigameError("BET_TOO_HIGH", `Bet cannot exceed ${cfg.maxBet}`));
  }

  if (cooldowns.isOnCooldown(userId, "coinflip")) {
    const remaining = cooldowns.getRemainingMs(userId, "coinflip");
    return ErrResult(new MinigameError("COOLDOWN_ACTIVE", `Coinflip is on cooldown. Try again in ${remaining}ms`));
  }

  const accountRes = await ensureAccount(userId);
  if (accountRes.isErr()) return ErrResult(new MinigameError("INVALID_INPUT", accountRes.error.message));
  const { account } = accountRes.unwrap();

  if (!isAccountActive(account.status)) {
    return ErrResult(new MinigameError("ACCOUNT_INACTIVE", "Your economy account is not active"));
  }

  const balRes = await getBalance(userId, cfg.currencyId);
  if (balRes.isErr()) return ErrResult(new MinigameError("INVALID_INPUT", balRes.error.message));
  const balance = balRes.unwrap();

  if (balance < betAmount) {
    return ErrResult(new MinigameError("INSUFFICIENT_FUNDS", `You need at least ${betAmount} ${cfg.currencyId} to play`));
  }

  const outcome: "heads" | "tails" = Math.random() < 0.5 ? "heads" : "tails";
  const won = outcome === choice;

  let winnings = 0;
  let newBalance = 0;

  if (won) {
    const gross = betAmount * 2;
    const fee = Math.floor(gross * cfg.houseEdge);
    winnings = gross - fee;
    const delta = winnings - betAmount;
    const adjRes = await adjustBalance(userId, cfg.currencyId, delta);
    if (adjRes.isErr()) return ErrResult(new MinigameError("INVALID_INPUT", adjRes.error.message));
    newBalance = adjRes.unwrap().newBalance;
  } else {
    const adjRes = await adjustBalance(userId, cfg.currencyId, -betAmount);
    if (adjRes.isErr()) return ErrResult(new MinigameError("INVALID_INPUT", adjRes.error.message));
    newBalance = adjRes.unwrap().newBalance;
  }

  cooldowns.set(userId, "coinflip", cfg.cooldownMs);

  return OkResult({ outcome, choice, won, betAmount, winnings, newBalance });
}

// ---------------------------------------------------------------------------
// startTrivia
// ---------------------------------------------------------------------------

export async function startTrivia(
  userId: string,
  guildId: string,
  config?: { currencyId?: string; baseReward?: number; timeoutMs?: number },
): Promise<Result<TriviaStartResult, MinigameError>> {
  if (cooldowns.isOnCooldown(userId, "trivia")) {
    const remaining = cooldowns.getRemainingMs(userId, "trivia");
    return ErrResult(new MinigameError("COOLDOWN_ACTIVE", `Trivia is on cooldown. Try again in ${remaining}ms`));
  }

  const accountRes = await ensureAccount(userId);
  if (accountRes.isErr()) return ErrResult(new MinigameError("INVALID_INPUT", accountRes.error.message));
  const { account } = accountRes.unwrap();

  if (!isAccountActive(account.status)) {
    return ErrResult(new MinigameError("ACCOUNT_INACTIVE", "Your economy account is not active"));
  }

  const question = TRIVIA_QUESTIONS[Math.floor(Math.random() * TRIVIA_QUESTIONS.length)];
  const sessionKey = `${userId}:${guildId}`;
  const session: TriviaSession = {
    questionId: question.id,
    userId,
    guildId,
    startedAt: Date.now(),
    currencyId: config?.currencyId ?? "coins",
    baseReward: config?.baseReward ?? 20,
    difficulty: question.difficulty,
  };

  sessions.set(sessionKey, session);

  return OkResult({ sessionKey, question, timeoutMs: config?.timeoutMs ?? 60_000 });
}

// ---------------------------------------------------------------------------
// answerTrivia
// ---------------------------------------------------------------------------

export async function answerTrivia(
  sessionKey: string,
  answerIndex: number,
  timeoutMs: number = 60_000,
): Promise<Result<TriviaAnswerResult, MinigameError>> {
  const raw = sessions.get(sessionKey);
  if (!raw) {
    return ErrResult(new MinigameError("SESSION_NOT_FOUND", "No active trivia session found"));
  }

  const session = raw as TriviaSession;

  if (Date.now() - session.startedAt > timeoutMs) {
    sessions.delete(sessionKey);
    const question = TRIVIA_QUESTIONS.find((q) => q.id === session.questionId);
    return ErrResult(new MinigameError("SESSION_EXPIRED", `Time's up! The correct answer was ${question ? String.fromCharCode(65 + question.correctIndex) : "unknown"}`));
  }

  sessions.delete(sessionKey);
  cooldowns.set(session.userId, "trivia", 30_000);

  const question = TRIVIA_QUESTIONS.find((q) => q.id === session.questionId);
  if (!question) {
    return ErrResult(new MinigameError("INVALID_INPUT", "Question not found"));
  }

  const correct = answerIndex === question.correctIndex;

  if (!correct) {
    return OkResult({ correct: false, correctIndex: question.correctIndex, reward: 0, newBalance: 0 });
  }

  const multipliers: Record<1 | 2 | 3, number> = { 1: 1, 2: 1.5, 3: 2.5 };
  const reward = Math.floor(session.baseReward * multipliers[session.difficulty]);

  const adjRes = await adjustBalance(session.userId, session.currencyId, reward);
  if (adjRes.isErr()) return ErrResult(new MinigameError("INVALID_INPUT", adjRes.error.message));
  const newBalance = adjRes.unwrap().newBalance;

  return OkResult({ correct: true, correctIndex: question.correctIndex, reward, newBalance });
}

// ---------------------------------------------------------------------------
// rob
// ---------------------------------------------------------------------------

export async function rob(
  robberId: string,
  targetId: string,
  config?: Partial<RobConfig>,
): Promise<Result<RobResult, MinigameError>> {
  const cfg: RobConfig = { ...DEFAULT_ROB_CONFIG, ...config };

  if (robberId === targetId) {
    return ErrResult(new MinigameError("INVALID_INPUT", "You cannot rob yourself"));
  }

  if (cooldowns.isOnCooldown(robberId, "rob")) {
    const remaining = cooldowns.getRemainingMs(robberId, "rob");
    return ErrResult(new MinigameError("COOLDOWN_ACTIVE", `Rob is on cooldown. Try again in ${remaining}ms`));
  }

  if (cooldowns.isOnCooldown(robberId, `rob:${targetId}`)) {
    const remaining = cooldowns.getRemainingMs(robberId, `rob:${targetId}`);
    return ErrResult(new MinigameError("COOLDOWN_ACTIVE", `You recently robbed this person. Try again in ${remaining}ms`));
  }

  const robberRes = await ensureAccount(robberId);
  if (robberRes.isErr()) return ErrResult(new MinigameError("INVALID_INPUT", robberRes.error.message));
  const { account: robberAccount } = robberRes.unwrap();

  if (!isAccountActive(robberAccount.status)) {
    return ErrResult(new MinigameError("ACCOUNT_INACTIVE", "Your economy account is not active"));
  }

  const targetBalRes = await getBalance(targetId, cfg.currencyId);
  if (targetBalRes.isErr()) return ErrResult(new MinigameError("INVALID_INPUT", targetBalRes.error.message));
  const targetBalance = targetBalRes.unwrap();

  if (targetBalance < cfg.minTargetBalance) {
    return ErrResult(new MinigameError("TARGET_INSUFFICIENT_FUNDS", `Target doesn't have enough ${cfg.currencyId} to rob`));
  }

  const stealAmount = Math.min(Math.floor(targetBalance * cfg.maxStealPct), cfg.maxStealAmount);
  const failed = Math.random() < cfg.failChance;

  cooldowns.set(robberId, "rob", cfg.cooldownMs);
  cooldowns.set(robberId, `rob:${targetId}`, cfg.pairCooldownMs);

  if (!failed) {
    const robberAdjRes = await adjustBalance(robberId, cfg.currencyId, stealAmount);
    if (robberAdjRes.isErr()) return ErrResult(new MinigameError("INVALID_INPUT", robberAdjRes.error.message));
    const robberNewBalance = robberAdjRes.unwrap().newBalance;

    const targetAdjRes = await adjustBalance(targetId, cfg.currencyId, -stealAmount);
    if (targetAdjRes.isErr()) return ErrResult(new MinigameError("INVALID_INPUT", targetAdjRes.error.message));
    const targetNewBalance = targetAdjRes.unwrap().newBalance;

    return OkResult({ success: true, stolenAmount: stealAmount, fineAmount: 0, robberNewBalance, targetNewBalance });
  }

  // Robbery failed — apply fine to robber
  const rawFine = Math.max(Math.floor(stealAmount * cfg.failFinePct), cfg.failFineMin);
  const fineRes = await adjustBalance(robberId, cfg.currencyId, -rawFine, { allowDebt: false });
  const fineAmount = fineRes.isErr() ? 0 : rawFine;

  const robberBalRes = await getBalance(robberId, cfg.currencyId);
  const robberNewBalance = robberBalRes.isOk() ? robberBalRes.unwrap() : 0;

  return OkResult({ success: false, stolenAmount: 0, fineAmount, robberNewBalance, targetNewBalance: targetBalance });
}
