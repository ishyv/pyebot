/**
 * Economy achievements: progress tracking, unlock recording, reward claiming.
 *
 * Architecture: Plain exported async functions — no classes (except AchievementError).
 * Dependencies: the `Achievements` component on the User entity for storage,
 *   adjustBalance from mutations (for currency rewards).
 *
 * NOTE: XP rewards require the progression module (not yet implemented).
 *       Item rewards require the inventory module (not yet implemented).
 *       Title/badge equipping is handled separately.
 */

import { Achievements } from "@/components/economy/achievements";
import { User } from "@/components/entities";
import { ErrResult, OkResult, type Result } from "@/core/result";
import { adjustBalance } from "@/features/economy/mutations";
import type { EntityHandle } from "@/framework/entity-handle";
import type { Ctx } from "@/framework/types";

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class AchievementError extends Error {
  constructor(
    public readonly code:
      | "ACHIEVEMENT_NOT_FOUND"
      | "ACHIEVEMENT_ALREADY_UNLOCKED"
      | "ACHIEVEMENT_NOT_UNLOCKED"
      | "REWARDS_ALREADY_CLAIMED"
      | "UPDATE_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "AchievementError";
  }
}

// ---------------------------------------------------------------------------
// Achievement definition types
// ---------------------------------------------------------------------------

export type AchievementTier = "bronze" | "silver" | "gold" | "platinum" | "diamond";
export type AchievementCategory = "progression" | "minigame" | "social" | "special";
export type UnlockConditionType =
  | "streak_milestone"
  | "trivia_wins"
  | "coinflip_streak"
  | "rob_success"
  | "quest_completions"
  | "currency_held"
  | "special";

export interface AchievementReward {
  readonly type: "currency" | "xp" | "title" | "badge";
  readonly currencyId?: string;
  readonly amount?: number;
  readonly titleId?: string;
  readonly titleName?: string;
  readonly titlePrefix?: string;
  readonly badgeId?: string;
  readonly badgeEmoji?: string;
  readonly badgeName?: string;
}

export interface AchievementDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly tier: AchievementTier;
  readonly category: AchievementCategory;
  readonly conditionType: UnlockConditionType;
  readonly target: number;
  readonly rewards: AchievementReward[];
  readonly hidden?: boolean;
  readonly displayOrder: number;
}

// ---------------------------------------------------------------------------
// Built-in achievement definitions
// ---------------------------------------------------------------------------

export const ACHIEVEMENT_DEFINITIONS: readonly AchievementDefinition[] = [
  {
    id: "streak_7",
    name: "Consistency",
    description: "Maintain a 7-day daily streak.",
    tier: "bronze",
    category: "progression",
    conditionType: "streak_milestone",
    target: 7,
    rewards: [{ type: "currency", currencyId: "coins", amount: 500 }],
    displayOrder: 1,
  },
  {
    id: "streak_30",
    name: "Legend of Consistency",
    description: "Maintain a 30-day daily streak.",
    tier: "gold",
    category: "progression",
    conditionType: "streak_milestone",
    target: 30,
    rewards: [
      { type: "currency", currencyId: "coins", amount: 2500 },
      { type: "badge", badgeId: "badge_streak", badgeEmoji: "🔥", badgeName: "Unbreakable Streak" },
    ],
    displayOrder: 2,
  },
  {
    id: "trivia_10",
    name: "Trivia Expert",
    description: "Win 10 trivia rounds.",
    tier: "bronze",
    category: "minigame",
    conditionType: "trivia_wins",
    target: 10,
    rewards: [{ type: "currency", currencyId: "coins", amount: 300 }],
    displayOrder: 10,
  },
  {
    id: "trivia_50",
    name: "Trivia Master",
    description: "Win 50 trivia rounds.",
    tier: "silver",
    category: "minigame",
    conditionType: "trivia_wins",
    target: 50,
    rewards: [
      { type: "currency", currencyId: "coins", amount: 1500 },
      {
        type: "title",
        titleId: "title_trivia_master",
        titleName: "Trivia Master",
        titlePrefix: "[Trivia Master] ",
      },
    ],
    displayOrder: 11,
  },
  {
    id: "coinflip_streak_5",
    name: "Lucky Flipper",
    description: "Win 5 coinflips in a row.",
    tier: "silver",
    category: "minigame",
    conditionType: "coinflip_streak",
    target: 5,
    rewards: [{ type: "currency", currencyId: "coins", amount: 1000 }],
    displayOrder: 20,
  },
  {
    id: "quest_10",
    name: "Quest Veteran",
    description: "Complete 10 quests.",
    tier: "bronze",
    category: "progression",
    conditionType: "quest_completions",
    target: 10,
    rewards: [{ type: "currency", currencyId: "coins", amount: 400 }],
    displayOrder: 30,
  },
];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getDefinition(achievementId: string): AchievementDefinition | undefined {
  return ACHIEVEMENT_DEFINITIONS.find((d) => d.id === achievementId);
}

function getDefinitionsForCondition(conditionType: UnlockConditionType): AchievementDefinition[] {
  return ACHIEVEMENT_DEFINITIONS.filter((d) => d.conditionType === conditionType);
}

/**
 * Record an unlock if one isn't already present. Callers invoke this only once
 * the achievement is complete, so completion is the caller's precondition.
 * Returns whether this call was the one that recorded the unlock.
 */
async function tryUnlock(u: EntityHandle, achievementId: string): Promise<boolean> {
  if ((await u.get(Achievements)).unlocked[achievementId]) return false;
  await u.update(Achievements, (a) => ({
    unlocked: {
      ...a.unlocked,
      [achievementId]: { unlockedAt: new Date(), rewardsClaimed: false },
    },
  }));
  return true;
}

// ---------------------------------------------------------------------------
// updateProgress — set progress to an absolute value
// ---------------------------------------------------------------------------

export async function updateProgress(
  ctx: Ctx,
  userId: string,
  conditionType: UnlockConditionType,
  value: number,
): Promise<Result<{ newlyUnlocked: string[] }, AchievementError>> {
  const u = ctx.of(User, userId);
  const definitions = getDefinitionsForCondition(conditionType);
  const newlyUnlocked: string[] = [];

  for (const definition of definitions) {
    const newProgress = Math.min(value, definition.target);
    const completed = value >= definition.target;

    await u.update(Achievements, (a) => ({
      progress: {
        ...a.progress,
        [definition.id]: {
          progress: newProgress,
          target: definition.target,
          completed,
          updatedAt: new Date(),
        },
      },
    }));

    if (completed && (await tryUnlock(u, definition.id))) newlyUnlocked.push(definition.id);
  }

  return OkResult({ newlyUnlocked });
}

// ---------------------------------------------------------------------------
// incrementProgress — add to the current progress counter
// ---------------------------------------------------------------------------

export async function incrementProgress(
  ctx: Ctx,
  userId: string,
  conditionType: UnlockConditionType,
  amount = 1,
): Promise<Result<{ newlyUnlocked: string[] }, AchievementError>> {
  const u = ctx.of(User, userId);
  const definitions = getDefinitionsForCondition(conditionType);
  const newlyUnlocked: string[] = [];

  for (const definition of definitions) {
    const a = await u.get(Achievements);
    if (a.unlocked[definition.id]) continue; // already unlocked

    const current = a.progress[definition.id]?.progress ?? 0;
    const newProgress = Math.min(current + amount, definition.target);
    const completed = newProgress >= definition.target;

    await u.update(Achievements, (cur) => ({
      progress: {
        ...cur.progress,
        [definition.id]: {
          progress: newProgress,
          target: definition.target,
          completed,
          updatedAt: new Date(),
        },
      },
    }));

    if (completed && (await tryUnlock(u, definition.id))) newlyUnlocked.push(definition.id);
  }

  return OkResult({ newlyUnlocked });
}

// ---------------------------------------------------------------------------
// claimRewards — apply rewards for a completed achievement
// ---------------------------------------------------------------------------

export async function claimRewards(
  ctx: Ctx,
  userId: string,
  achievementId: string,
): Promise<Result<{ appliedRewards: AppliedReward[] }, AchievementError>> {
  const definition = getDefinition(achievementId);
  if (!definition) {
    return ErrResult(
      new AchievementError("ACHIEVEMENT_NOT_FOUND", `Achievement "${achievementId}" not found`),
    );
  }

  const u = ctx.of(User, userId);
  const unlock = (await u.get(Achievements)).unlocked[achievementId];
  if (!unlock) {
    return ErrResult(
      new AchievementError("ACHIEVEMENT_NOT_UNLOCKED", "Achievement not yet unlocked"),
    );
  }

  if (unlock.rewardsClaimed) {
    return ErrResult(new AchievementError("REWARDS_ALREADY_CLAIMED", "Rewards already claimed"));
  }

  const appliedRewards: AppliedReward[] = [];

  for (const reward of definition.rewards) {
    if (reward.type === "currency" && reward.currencyId && reward.amount) {
      try {
        await adjustBalance(ctx, userId, reward.currencyId, reward.amount);
        appliedRewards.push({
          type: "currency",
          description: `${reward.amount} ${reward.currencyId}`,
          amount: reward.amount,
        });
      } catch {
        /* skip reward on mutation failure */
      }
    } else if (reward.type === "title") {
      // Title is noted in the reward list; equipping is handled by the title command
      appliedRewards.push({
        type: "title",
        description: `Title: "${reward.titleName ?? reward.titleId}"`,
      });
    } else if (reward.type === "badge") {
      appliedRewards.push({
        type: "badge",
        description: `Badge: ${reward.badgeEmoji ?? ""} ${reward.badgeName ?? reward.badgeId}`,
      });
    } else if (reward.type === "xp" && reward.amount) {
      // TODO: apply XP when progression module is implemented
      appliedRewards.push({
        type: "xp",
        description: `${reward.amount} XP (pending progression module)`,
        amount: reward.amount,
      });
    }
  }

  await u.update(Achievements, (a) => ({
    unlocked: {
      ...a.unlocked,
      [achievementId]: { ...unlock, rewardsClaimed: true, rewardsClaimedAt: new Date() },
    },
  }));

  return OkResult({ appliedRewards });
}

export interface AppliedReward {
  readonly type: "currency" | "xp" | "title" | "badge";
  readonly description: string;
  readonly amount?: number;
}

// ---------------------------------------------------------------------------
// getBoard — full achievement board for a user
// ---------------------------------------------------------------------------

export interface AchievementView {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly tier: AchievementTier;
  readonly category: AchievementCategory;
  readonly progress: number;
  readonly target: number;
  readonly isUnlocked: boolean;
  readonly unlockedAt?: Date;
  readonly rewardsClaimed: boolean;
  readonly hidden: boolean;
}

export interface AchievementBoard {
  readonly achievements: AchievementView[];
  readonly unlockedCount: number;
  readonly totalCount: number;
}

export async function getBoard(
  ctx: Ctx,
  userId: string,
): Promise<Result<AchievementBoard, AchievementError>> {
  const { progress, unlocked } = await ctx.of(User, userId).get(Achievements);

  const views: AchievementView[] = ACHIEVEMENT_DEFINITIONS.map((def) => {
    const unlock = unlocked[def.id];
    return {
      id: def.id,
      name: def.name,
      description: def.description,
      tier: def.tier,
      category: def.category,
      progress: progress[def.id]?.progress ?? 0,
      target: def.target,
      isUnlocked: !!unlock,
      unlockedAt: unlock?.unlockedAt,
      rewardsClaimed: unlock?.rewardsClaimed ?? false,
      hidden: def.hidden ?? false,
    };
  });

  return OkResult({
    achievements: views,
    unlockedCount: Object.keys(unlocked).length,
    totalCount: ACHIEVEMENT_DEFINITIONS.length,
  });
}
