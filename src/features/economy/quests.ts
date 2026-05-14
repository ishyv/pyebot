/**
 * Economy quests: accept, progress, claim rewards.
 *
 * Architecture: Plain exported async functions — no classes (except QuestError).
 * Dependencies: locks from core/state (claim exclusion), adjustBalance from mutations,
 *   questProgressStore / getActiveQuestsForUser from economy repo.
 *
 * NOTE: XP rewards pending progression module. Item rewards pending inventory module.
 *       Progress events are called from event handlers (gather, fight, craft, market commands).
 */

import { OkResult, ErrResult, type Result } from "@/core/result";
import type { Ctx } from "@/framework/types";
import { locks } from "@/core/state";
import { adjustBalance } from "@/features/economy/mutations";
import {
  questProgressStore,
  getActiveQuestsForUser,
} from "@/db/repositories/economy";
import { buildProgressId } from "@/utils/ids";
import type { QuestProgressDoc } from "@/db/schemas/quest";

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class QuestError extends Error {
  constructor(
    public readonly code:
      | "QUEST_NOT_FOUND"
      | "QUEST_ALREADY_ACTIVE"
      | "QUEST_NOT_STARTED"
      | "QUEST_NOT_COMPLETED"
      | "REWARDS_ALREADY_CLAIMED"
      | "CLAIM_LOCKED"
      | "PREREQUISITES_NOT_MET"
      | "UPDATE_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "QuestError";
  }
}

// ---------------------------------------------------------------------------
// Quest definition types
// ---------------------------------------------------------------------------

export type QuestDifficulty = "easy" | "medium" | "hard" | "expert" | "legendary";
export type QuestRepeat =
  | { kind: "none" }
  | { kind: "daily" }
  | { kind: "weekly" }
  | { kind: "cooldown"; hours: number };

export type QuestStepKind = "gather_item" | "fight_win" | "craft_recipe" | "market_buy_item";

export interface QuestStep {
  readonly kind: QuestStepKind;
  readonly qty: number;
  /** For gather_item / market_buy_item / craft_recipe steps. */
  readonly itemId?: string;
  readonly recipeId?: string;
}

export interface QuestCurrencyReward {
  readonly currencyId: string;
  readonly amount: number;
}

export interface QuestRewards {
  readonly currency?: readonly QuestCurrencyReward[];
  readonly xp?: number;
}

export interface QuestDef {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly difficulty: QuestDifficulty;
  readonly repeat: QuestRepeat;
  readonly steps: readonly QuestStep[];
  readonly rewards: QuestRewards;
  readonly enabled?: boolean;
}

// ---------------------------------------------------------------------------
// Built-in quest definitions
// ---------------------------------------------------------------------------

export const QUEST_DEFINITIONS: readonly QuestDef[] = [
  {
    id: "quest_gather_stone",
    title: "Stone Gathering",
    description: "Mine 20 stones.",
    difficulty: "easy",
    repeat: { kind: "daily" },
    steps: [{ kind: "gather_item", itemId: "stone", qty: 20 }],
    rewards: { currency: [{ currencyId: "coins", amount: 150 }] },
    enabled: true,
  },
  {
    id: "quest_gather_wood",
    title: "Lumber Run",
    description: "Gather 15 wood.",
    difficulty: "easy",
    repeat: { kind: "daily" },
    steps: [{ kind: "gather_item", itemId: "wood", qty: 15 }],
    rewards: { currency: [{ currencyId: "coins", amount: 120 }] },
    enabled: true,
  },
  {
    id: "quest_fight_5",
    title: "Warrior's Trial",
    description: "Win 5 fights.",
    difficulty: "medium",
    repeat: { kind: "daily" },
    steps: [{ kind: "fight_win", qty: 5 }],
    rewards: { currency: [{ currencyId: "coins", amount: 400 }], xp: 50 },
    enabled: true,
  },
  {
    id: "quest_mixed_gather",
    title: "Supply Run",
    description: "Gather 10 wood and 10 stone.",
    difficulty: "medium",
    repeat: { kind: "weekly" },
    steps: [
      { kind: "gather_item", itemId: "wood", qty: 10 },
      { kind: "gather_item", itemId: "stone", qty: 10 },
    ],
    rewards: { currency: [{ currencyId: "coins", amount: 600 }], xp: 75 },
    enabled: true,
  },
  {
    id: "quest_fight_20",
    title: "Veteran Fighter",
    description: "Win 20 fights.",
    difficulty: "hard",
    repeat: { kind: "none" },
    steps: [{ kind: "fight_win", qty: 20 }],
    rewards: { currency: [{ currencyId: "coins", amount: 2000 }], xp: 200 },
    enabled: true,
  },
];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getDefinition(questId: string): QuestDef | undefined {
  return QUEST_DEFINITIONS.find((q) => q.id === questId && q.enabled !== false);
}

function isAllStepsComplete(def: QuestDef, stepProgress: readonly number[]): boolean {
  return def.steps.every((step, i) => (stepProgress[i] ?? 0) >= step.qty);
}

// ---------------------------------------------------------------------------
// acceptQuest
// ---------------------------------------------------------------------------

export async function acceptQuest(
  userId: string,
  questId: string,
): Promise<Result<QuestProgressDoc, QuestError>> {
  const def = getDefinition(questId);
  if (!def) {
    return ErrResult(new QuestError("QUEST_NOT_FOUND", `Quest "${questId}" not found`));
  }

  const docId = buildProgressId(userId, questId);
  const existing = await questProgressStore.get(docId);
  if (existing.isErr()) return ErrResult(new QuestError("UPDATE_FAILED", existing.error.message));

  if (existing.unwrap() && !existing.unwrap()!.rewardsClaimed) {
    return ErrResult(new QuestError("QUEST_ALREADY_ACTIVE", "This quest is already active or completed"));
  }

  const now = new Date();
  const doc: QuestProgressDoc = {
    _id: docId,
    userId,
    questId,
    stepProgress: new Array(def.steps.length).fill(0),
    completed: false,
    rewardsClaimed: false,
    startedAt: now,
  };

  const saveRes = await questProgressStore.set(docId, doc);
  if (saveRes.isErr()) return ErrResult(new QuestError("UPDATE_FAILED", saveRes.error.message));

  return OkResult(doc);
}

// ---------------------------------------------------------------------------
// progressQuest — called by event handlers to advance step progress
// ---------------------------------------------------------------------------

export type QuestEvent =
  | { kind: "gather_item"; itemId: string; qty: number }
  | { kind: "fight_win"; qty?: number }
  | { kind: "craft_recipe"; recipeId: string; qty?: number }
  | { kind: "market_buy_item"; itemId: string; qty?: number };

export async function progressQuest(
  userId: string,
  questId: string,
  event: QuestEvent,
): Promise<Result<{ completed: boolean; stepProgress: number[] }, QuestError>> {
  const def = getDefinition(questId);
  if (!def) {
    return ErrResult(new QuestError("QUEST_NOT_FOUND", `Quest "${questId}" not found`));
  }

  const docId = buildProgressId(userId, questId);
  const existing = await questProgressStore.get(docId);
  if (existing.isErr()) return ErrResult(new QuestError("UPDATE_FAILED", existing.error.message));

  const doc = existing.unwrap();
  if (!doc) return ErrResult(new QuestError("QUEST_NOT_STARTED", "Quest not accepted"));
  if (doc.completed) return OkResult({ completed: true, stepProgress: doc.stepProgress });

  const newStepProgress = [...doc.stepProgress];

  for (let i = 0; i < def.steps.length; i++) {
    const step = def.steps[i];
    const current = newStepProgress[i] ?? 0;
    if (current >= step.qty) continue; // already done

    const matches =
      (step.kind === "gather_item" && event.kind === "gather_item" && step.itemId === event.itemId) ||
      (step.kind === "fight_win" && event.kind === "fight_win") ||
      (step.kind === "craft_recipe" && event.kind === "craft_recipe" && step.recipeId === event.recipeId) ||
      (step.kind === "market_buy_item" && event.kind === "market_buy_item" && step.itemId === event.itemId);

    if (matches) {
      const increment = event.qty ?? 1;
      newStepProgress[i] = Math.min(current + increment, step.qty);
    }
  }

  const completed = isAllStepsComplete(def, newStepProgress);
  const updated: QuestProgressDoc = {
    ...doc,
    stepProgress: newStepProgress,
    completed,
    completedAt: completed && !doc.completed ? new Date() : doc.completedAt,
  };

  await questProgressStore.set(docId, updated);
  return OkResult({ completed, stepProgress: newStepProgress });
}

// ---------------------------------------------------------------------------
// progressAllQuests — progress all active quests for a user from a single event
// ---------------------------------------------------------------------------

export async function progressAllQuests(
  userId: string,
  event: QuestEvent,
): Promise<Result<void, QuestError>> {
  const activeRes = await getActiveQuestsForUser(userId);
  if (activeRes.isErr()) return ErrResult(new QuestError("UPDATE_FAILED", activeRes.error.message));

  for (const questDoc of activeRes.unwrap()) {
    if (questDoc.completed) continue;
    await progressQuest(userId, questDoc.questId, event);
  }

  return OkResult(undefined);
}

// ---------------------------------------------------------------------------
// claimRewards
// ---------------------------------------------------------------------------

export interface ClaimedQuestReward {
  readonly type: "currency" | "xp";
  readonly description: string;
  readonly amount?: number;
}

export async function claimRewards(
  ctx: Ctx,
  userId: string,
  questId: string,
): Promise<Result<{ rewards: ClaimedQuestReward[] }, QuestError>> {
  const lockKey = `quest:claim:${userId}:${questId}`;
  if (!locks.tryAcquire(lockKey)) {
    return ErrResult(new QuestError("CLAIM_LOCKED", "Claim already in progress"));
  }

  try {
    const def = getDefinition(questId);
    if (!def) {
      return ErrResult(new QuestError("QUEST_NOT_FOUND", `Quest "${questId}" not found`));
    }

    const docId = buildProgressId(userId, questId);
    const existing = await questProgressStore.get(docId);
    if (existing.isErr()) return ErrResult(new QuestError("UPDATE_FAILED", existing.error.message));

    const doc = existing.unwrap();
    if (!doc) return ErrResult(new QuestError("QUEST_NOT_STARTED", "Quest not started"));
    if (!doc.completed) return ErrResult(new QuestError("QUEST_NOT_COMPLETED", "Quest not yet completed"));
    if (doc.rewardsClaimed) return ErrResult(new QuestError("REWARDS_ALREADY_CLAIMED", "Rewards already claimed"));

    const appliedRewards: ClaimedQuestReward[] = [];

    // Apply currency rewards
    for (const reward of def.rewards.currency ?? []) {
      try {
        await adjustBalance(ctx, userId, reward.currencyId, reward.amount);
        appliedRewards.push({ type: "currency", description: `${reward.amount} ${reward.currencyId}`, amount: reward.amount });
      } catch { /* skip reward on mutation failure */ }
    }

    // Note XP rewards (pending progression module)
    if (def.rewards.xp) {
      appliedRewards.push({ type: "xp", description: `${def.rewards.xp} XP (pending progression module)`, amount: def.rewards.xp });
    }

    // Mark claimed
    await questProgressStore.set(docId, { ...doc, rewardsClaimed: true, rewardsClaimedAt: new Date() });

    return OkResult({ rewards: appliedRewards });
  } finally {
    locks.release(lockKey);
  }
}

// ---------------------------------------------------------------------------
// getActiveQuests
// ---------------------------------------------------------------------------

export interface QuestView {
  readonly questId: string;
  readonly title: string;
  readonly description: string;
  readonly difficulty: QuestDifficulty;
  readonly stepProgress: number[];
  readonly stepTargets: number[];
  readonly completed: boolean;
  readonly rewardsClaimed: boolean;
  readonly startedAt: Date;
}

export async function getActiveQuests(
  userId: string,
): Promise<Result<QuestView[], QuestError>> {
  const activeRes = await getActiveQuestsForUser(userId);
  if (activeRes.isErr()) return ErrResult(new QuestError("UPDATE_FAILED", activeRes.error.message));

  const views: QuestView[] = [];
  for (const doc of activeRes.unwrap()) {
    const def = getDefinition(doc.questId);
    if (!def) continue;
    views.push({
      questId: doc.questId,
      title: def.title,
      description: def.description,
      difficulty: def.difficulty,
      stepProgress: doc.stepProgress,
      stepTargets: def.steps.map((s) => s.qty),
      completed: doc.completed,
      rewardsClaimed: doc.rewardsClaimed,
      startedAt: doc.startedAt,
    });
  }

  return OkResult(views);
}

// ---------------------------------------------------------------------------
// browseQuests — list available quests
// ---------------------------------------------------------------------------

export interface QuestBrowseItem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly difficulty: QuestDifficulty;
  readonly rewards: QuestRewards;
  readonly repeat: QuestRepeat;
  readonly stepSummaries: string[];
}

export function browseQuests(): QuestBrowseItem[] {
  return QUEST_DEFINITIONS.filter((q) => q.enabled !== false).map((q) => ({
    id: q.id,
    title: q.title,
    description: q.description,
    difficulty: q.difficulty,
    rewards: q.rewards,
    repeat: q.repeat,
    stepSummaries: q.steps.map((s) => {
      if (s.kind === "gather_item") return `Gather ${s.qty}x ${s.itemId}`;
      if (s.kind === "fight_win") return `Win ${s.qty} fights`;
      if (s.kind === "craft_recipe") return `Craft ${s.qty}x ${s.recipeId}`;
      if (s.kind === "market_buy_item") return `Buy ${s.qty}x ${s.itemId} from market`;
      return s.kind;
    }),
  }));
}
