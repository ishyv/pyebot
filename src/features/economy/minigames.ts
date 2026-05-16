/**
 * Economy minigames: coinflip, trivia, rob.
 *
 * All functions accept `ctx: Ctx` as first parameter. Failures throw
 * `MinigameError`; DB failures propagate as untyped errors caught at the
 * interaction boundary.
 */

import { ensureAccount, isAccountActive } from "@/features/economy/account";
import { adjustBalance, getBalance } from "@/features/economy/mutations";
import type { Ctx } from "@/framework/types";

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
  {
    id: "q1",
    question: "What is 2 + 2?",
    options: ["3", "4", "5", "6"],
    correctIndex: 1,
    category: "math",
    difficulty: 1,
  },
  {
    id: "q2",
    question: "What color is the sky on a clear day?",
    options: ["Green", "Blue", "Red", "Yellow"],
    correctIndex: 1,
    category: "general",
    difficulty: 1,
  },
  {
    id: "q3",
    question: "How many sides does a triangle have?",
    options: ["2", "3", "4", "5"],
    correctIndex: 1,
    category: "math",
    difficulty: 1,
  },
  {
    id: "q4",
    question: "What is the capital of France?",
    options: ["London", "Berlin", "Paris", "Rome"],
    correctIndex: 2,
    category: "geography",
    difficulty: 1,
  },
  {
    id: "q5",
    question: "What is 7 * 8?",
    options: ["54", "56", "58", "60"],
    correctIndex: 1,
    category: "math",
    difficulty: 2,
  },
  {
    id: "q6",
    question: "How many planets are in our solar system?",
    options: ["7", "8", "9", "10"],
    correctIndex: 1,
    category: "science",
    difficulty: 2,
  },
  {
    id: "q7",
    question: "What is the chemical symbol for water?",
    options: ["O2", "CO2", "H2O", "HO"],
    correctIndex: 2,
    category: "science",
    difficulty: 2,
  },
  {
    id: "q8",
    question: "Who wrote Romeo and Juliet?",
    options: ["Dickens", "Tolkien", "Shakespeare", "Austen"],
    correctIndex: 2,
    category: "literature",
    difficulty: 2,
  },
  {
    id: "q9",
    question: "What is the square root of 144?",
    options: ["10", "11", "12", "13"],
    correctIndex: 2,
    category: "math",
    difficulty: 2,
  },
  {
    id: "q10",
    question: "What year did World War II end?",
    options: ["1943", "1944", "1945", "1946"],
    correctIndex: 2,
    category: "history",
    difficulty: 2,
  },
  {
    id: "q11",
    question: "What is the largest ocean on Earth?",
    options: ["Atlantic", "Indian", "Arctic", "Pacific"],
    correctIndex: 3,
    category: "geography",
    difficulty: 1,
  },
  {
    id: "q12",
    question: "How many bones are in the adult human body?",
    options: ["196", "206", "216", "226"],
    correctIndex: 1,
    category: "science",
    difficulty: 3,
  },
  {
    id: "q13",
    question: "What is the speed of light in km/s (approx)?",
    options: ["200,000", "300,000", "400,000", "500,000"],
    correctIndex: 1,
    category: "science",
    difficulty: 3,
  },
  {
    id: "q14",
    question: "In what year was the Eiffel Tower built?",
    options: ["1879", "1885", "1889", "1895"],
    correctIndex: 2,
    category: "history",
    difficulty: 3,
  },
  {
    id: "q15",
    question: "What is the atomic number of gold?",
    options: ["47", "72", "79", "83"],
    correctIndex: 2,
    category: "science",
    difficulty: 3,
  },
];

// ---------------------------------------------------------------------------
// coinflip
// ---------------------------------------------------------------------------

export async function coinflip(
  ctx: Ctx,
  userId: string,
  choice: "heads" | "tails",
  betAmount: number,
  config?: Partial<CoinflipConfig>,
): Promise<CoinflipResult> {
  const cfg: CoinflipConfig = { ...DEFAULT_COINFLIP_CONFIG, ...config };

  if (choice !== "heads" && choice !== "tails") {
    throw new MinigameError("INVALID_CHOICE", 'Choice must be "heads" or "tails"');
  }
  if (!Number.isInteger(betAmount) || betAmount < cfg.minBet) {
    throw new MinigameError("BET_TOO_LOW", `Bet must be at least ${cfg.minBet}`);
  }
  if (betAmount > cfg.maxBet) {
    throw new MinigameError("BET_TOO_HIGH", `Bet cannot exceed ${cfg.maxBet}`);
  }
  if (ctx.cooldowns.isOnCooldown(userId, "coinflip")) {
    const remaining = ctx.cooldowns.getRemainingMs(userId, "coinflip");
    throw new MinigameError(
      "COOLDOWN_ACTIVE",
      `Coinflip is on cooldown. Try again in ${remaining}ms`,
    );
  }

  const account = await ensureAccount(ctx, userId);
  if (!isAccountActive(account.status)) {
    throw new MinigameError("ACCOUNT_INACTIVE", "Your economy account is not active");
  }

  const balance = await getBalance(ctx, userId, cfg.currencyId);
  if (balance < betAmount) {
    throw new MinigameError(
      "INSUFFICIENT_FUNDS",
      `You need at least ${betAmount} ${cfg.currencyId} to play`,
    );
  }

  const outcome: "heads" | "tails" = Math.random() < 0.5 ? "heads" : "tails";
  const won = outcome === choice;

  let winnings = 0;
  let newBalance: number;

  if (won) {
    const gross = betAmount * 2;
    const fee = Math.floor(gross * cfg.houseEdge);
    winnings = gross - fee;
    newBalance = await adjustBalance(ctx, userId, cfg.currencyId, winnings - betAmount);
  } else {
    newBalance = await adjustBalance(ctx, userId, cfg.currencyId, -betAmount);
  }

  ctx.cooldowns.set(userId, "coinflip", cfg.cooldownMs);
  return { outcome, choice, won, betAmount, winnings, newBalance };
}

// ---------------------------------------------------------------------------
// startTrivia
// ---------------------------------------------------------------------------

export async function startTrivia(
  ctx: Ctx,
  userId: string,
  guildId: string,
  config?: { currencyId?: string; baseReward?: number; timeoutMs?: number },
): Promise<TriviaStartResult> {
  if (ctx.cooldowns.isOnCooldown(userId, "trivia")) {
    const remaining = ctx.cooldowns.getRemainingMs(userId, "trivia");
    throw new MinigameError(
      "COOLDOWN_ACTIVE",
      `Trivia is on cooldown. Try again in ${remaining}ms`,
    );
  }

  const account = await ensureAccount(ctx, userId);
  if (!isAccountActive(account.status)) {
    throw new MinigameError("ACCOUNT_INACTIVE", "Your economy account is not active");
  }

  const question = TRIVIA_QUESTIONS[Math.floor(Math.random() * TRIVIA_QUESTIONS.length)]!;
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

  ctx.sessions.set(sessionKey, session);
  return { sessionKey, question, timeoutMs: config?.timeoutMs ?? 60_000 };
}

// ---------------------------------------------------------------------------
// answerTrivia
// ---------------------------------------------------------------------------

export async function answerTrivia(
  ctx: Ctx,
  sessionKey: string,
  answerIndex: number,
  timeoutMs: number = 60_000,
): Promise<TriviaAnswerResult> {
  const raw = ctx.sessions.get(sessionKey);
  if (!raw) {
    throw new MinigameError("SESSION_NOT_FOUND", "No active trivia session found");
  }

  const session = raw as TriviaSession;

  if (Date.now() - session.startedAt > timeoutMs) {
    ctx.sessions.delete(sessionKey);
    const question = TRIVIA_QUESTIONS.find((q) => q.id === session.questionId);
    throw new MinigameError(
      "SESSION_EXPIRED",
      `Time's up! The correct answer was ${question ? String.fromCharCode(65 + question.correctIndex) : "unknown"}`,
    );
  }

  ctx.sessions.delete(sessionKey);
  ctx.cooldowns.set(session.userId, "trivia", 30_000);

  const question = TRIVIA_QUESTIONS.find((q) => q.id === session.questionId);
  if (!question) {
    throw new MinigameError("INVALID_INPUT", "Question not found");
  }

  const correct = answerIndex === question.correctIndex;

  if (!correct) {
    return { correct: false, correctIndex: question.correctIndex, reward: 0, newBalance: 0 };
  }

  const multipliers: Record<1 | 2 | 3, number> = { 1: 1, 2: 1.5, 3: 2.5 };
  const reward = Math.floor(session.baseReward * multipliers[session.difficulty]);
  const newBalance = await adjustBalance(ctx, session.userId, session.currencyId, reward);

  return { correct: true, correctIndex: question.correctIndex, reward, newBalance };
}

// ---------------------------------------------------------------------------
// rob
// ---------------------------------------------------------------------------

export async function rob(
  ctx: Ctx,
  robberId: string,
  targetId: string,
  config?: Partial<RobConfig>,
): Promise<RobResult> {
  const cfg: RobConfig = { ...DEFAULT_ROB_CONFIG, ...config };

  if (robberId === targetId) {
    throw new MinigameError("INVALID_INPUT", "You cannot rob yourself");
  }
  if (ctx.cooldowns.isOnCooldown(robberId, "rob")) {
    const remaining = ctx.cooldowns.getRemainingMs(robberId, "rob");
    throw new MinigameError("COOLDOWN_ACTIVE", `Rob is on cooldown. Try again in ${remaining}ms`);
  }
  if (ctx.cooldowns.isOnCooldown(robberId, `rob:${targetId}`)) {
    const remaining = ctx.cooldowns.getRemainingMs(robberId, `rob:${targetId}`);
    throw new MinigameError(
      "COOLDOWN_ACTIVE",
      `You recently robbed this person. Try again in ${remaining}ms`,
    );
  }

  const robberAccount = await ensureAccount(ctx, robberId);
  if (!isAccountActive(robberAccount.status)) {
    throw new MinigameError("ACCOUNT_INACTIVE", "Your economy account is not active");
  }

  const targetBalance = await getBalance(ctx, targetId, cfg.currencyId);
  if (targetBalance < cfg.minTargetBalance) {
    throw new MinigameError(
      "TARGET_INSUFFICIENT_FUNDS",
      `Target doesn't have enough ${cfg.currencyId} to rob`,
    );
  }

  const stealAmount = Math.min(Math.floor(targetBalance * cfg.maxStealPct), cfg.maxStealAmount);
  const failed = Math.random() < cfg.failChance;

  ctx.cooldowns.set(robberId, "rob", cfg.cooldownMs);
  ctx.cooldowns.set(robberId, `rob:${targetId}`, cfg.pairCooldownMs);

  if (!failed) {
    const robberNewBalance = await adjustBalance(ctx, robberId, cfg.currencyId, stealAmount);
    const targetNewBalance = await adjustBalance(ctx, targetId, cfg.currencyId, -stealAmount);
    return {
      success: true,
      stolenAmount: stealAmount,
      fineAmount: 0,
      robberNewBalance,
      targetNewBalance,
    };
  }

  // Robbery failed — apply fine to robber (best effort, no throw on insufficient)
  const rawFine = Math.max(Math.floor(stealAmount * cfg.failFinePct), cfg.failFineMin);
  let fineAmount = rawFine;
  try {
    await adjustBalance(ctx, robberId, cfg.currencyId, -rawFine, { allowDebt: false });
  } catch {
    fineAmount = 0;
  }

  const robberNewBalance = await getBalance(ctx, robberId, cfg.currencyId);
  return {
    success: false,
    stolenAmount: 0,
    fineAmount,
    robberNewBalance,
    targetNewBalance: targetBalance,
  };
}
