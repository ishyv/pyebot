/**
 * RPG Quests.
 *
 * Purpose: RPG-specific quest definitions and profession-gated accept logic.
 * Architecture: Re-exports economy quest functions; adds RPG quest definitions
 *   and a profession-aware accept wrapper.
 *
 * Design: RPG quests are stored and tracked using the same infrastructure as
 *   economy quests (questProgressStore, progressAllQuests). This file provides:
 *   1. RPG quest definitions (profession-gated, gathering/fighting focused).
 *   2. acceptRpgQuest — validates profession prerequisite before delegating.
 *   3. Re-exports progressAllQuests / claimRewards from economy quests.
 *
 * Quest IDs in this file use the "rpg_" prefix to avoid collisions with economy quests.
 */

import { ErrResult, type Result } from "@/core/result";
import { getRpgProfile } from "@/db/repositories/rpg";
import type { QuestProgressDoc } from "@/db/schemas/quest";
import {
  acceptQuest,
  type ClaimedQuestReward,
  claimRewards,
  progressAllQuests,
  type QuestDef,
  type QuestError,
} from "@/features/economy/quests";

export type { ClaimedQuestReward, QuestProgressDoc };
// Re-export the shared functions so RPG callers only need one import.
export { claimRewards, progressAllQuests };

// ---------------------------------------------------------------------------
// RPG quest definitions
// ---------------------------------------------------------------------------

export const RPG_QUEST_DEFINITIONS: readonly QuestDef[] = [
  // ----- Miner quests -----
  {
    id: "rpg_miner_stone_daily",
    title: "Stone Haul",
    description: "Mine 30 stone.",
    difficulty: "easy",
    repeat: { kind: "daily" },
    steps: [{ kind: "gather_item", itemId: "stone", qty: 30 }],
    rewards: { currency: [{ currencyId: "coins", amount: 200 }] },
    enabled: true,
  },
  {
    id: "rpg_miner_copper_weekly",
    title: "Copper Run",
    description: "Mine 20 copper ore.",
    difficulty: "medium",
    repeat: { kind: "weekly" },
    steps: [{ kind: "gather_item", itemId: "copper_ore", qty: 20 }],
    rewards: { currency: [{ currencyId: "coins", amount: 800 }], xp: 60 },
    enabled: true,
  },
  {
    id: "rpg_miner_iron_weekly",
    title: "Iron Extraction",
    description: "Mine 15 iron ore.",
    difficulty: "hard",
    repeat: { kind: "weekly" },
    steps: [{ kind: "gather_item", itemId: "iron_ore", qty: 15 }],
    rewards: { currency: [{ currencyId: "coins", amount: 1500 }], xp: 120 },
    enabled: true,
  },

  // ----- Lumber quests -----
  {
    id: "rpg_lumber_oak_daily",
    title: "Oak Harvest",
    description: "Cut down 25 oak wood.",
    difficulty: "easy",
    repeat: { kind: "daily" },
    steps: [{ kind: "gather_item", itemId: "oak_wood", qty: 25 }],
    rewards: { currency: [{ currencyId: "coins", amount: 200 }] },
    enabled: true,
  },
  {
    id: "rpg_lumber_spruce_weekly",
    title: "Spruce Clearing",
    description: "Cut down 20 spruce wood.",
    difficulty: "medium",
    repeat: { kind: "weekly" },
    steps: [{ kind: "gather_item", itemId: "spruce_wood", qty: 20 }],
    rewards: { currency: [{ currencyId: "coins", amount: 800 }], xp: 60 },
    enabled: true,
  },
  {
    id: "rpg_lumber_palm_weekly",
    title: "Tropical Timber",
    description: "Cut down 15 palm wood.",
    difficulty: "hard",
    repeat: { kind: "weekly" },
    steps: [{ kind: "gather_item", itemId: "palm_wood", qty: 15 }],
    rewards: { currency: [{ currencyId: "coins", amount: 1500 }], xp: 120 },
    enabled: true,
  },

  // ----- Combat quests (any profession) -----
  {
    id: "rpg_combat_daily",
    title: "Daily Skirmish",
    description: "Win 3 fights.",
    difficulty: "medium",
    repeat: { kind: "daily" },
    steps: [{ kind: "fight_win", qty: 3 }],
    rewards: { currency: [{ currencyId: "coins", amount: 300 }], xp: 30 },
    enabled: true,
  },
  {
    id: "rpg_combat_champion",
    title: "Champion",
    description: "Win 50 fights.",
    difficulty: "expert",
    repeat: { kind: "none" },
    steps: [{ kind: "fight_win", qty: 50 }],
    rewards: { currency: [{ currencyId: "coins", amount: 5000 }], xp: 500 },
    enabled: true,
  },
];

// Professions that gate certain quests
const MINER_QUEST_IDS = new Set([
  "rpg_miner_stone_daily",
  "rpg_miner_copper_weekly",
  "rpg_miner_iron_weekly",
]);

const LUMBER_QUEST_IDS = new Set([
  "rpg_lumber_oak_daily",
  "rpg_lumber_spruce_weekly",
  "rpg_lumber_palm_weekly",
]);

export type RpgQuestError = QuestError | { code: "PROFESSION_REQUIRED"; message: string };

// ---------------------------------------------------------------------------
// acceptRpgQuest
// ---------------------------------------------------------------------------

/**
 * Accept an RPG quest. Enforces profession prerequisites for profession-gated quests.
 * Delegates to economy acceptQuest for storage.
 */
export async function acceptRpgQuest(
  userId: string,
  questId: string,
): Promise<Result<QuestProgressDoc, QuestError>> {
  const def = RPG_QUEST_DEFINITIONS.find((q) => q.id === questId);
  if (!def) {
    // Fall through to economy acceptQuest which will return QUEST_NOT_FOUND
    return acceptQuest(userId, questId);
  }

  // Check profession gate
  if (MINER_QUEST_IDS.has(questId) || LUMBER_QUEST_IDS.has(questId)) {
    const profileRes = await getRpgProfile(userId);
    const profession = profileRes.isOk() ? profileRes.unwrap()?.starterKitType : null;

    if (MINER_QUEST_IDS.has(questId) && profession !== "miner") {
      return ErrResult(
        Object.assign(new Error("This quest requires the Miner profession"), {
          name: "QuestError",
          code: "PREREQUISITES_NOT_MET" as const,
        }) as unknown as QuestError,
      );
    }

    if (LUMBER_QUEST_IDS.has(questId) && profession !== "lumber") {
      return ErrResult(
        Object.assign(new Error("This quest requires the Lumber profession"), {
          name: "QuestError",
          code: "PREREQUISITES_NOT_MET" as const,
        }) as unknown as QuestError,
      );
    }
  }

  // Delegate to economy quest storage (also handles repeat/cooldown logic)
  return acceptQuest(userId, questId);
}

// ---------------------------------------------------------------------------
// listRpgQuests — list available quests for a user's profession
// ---------------------------------------------------------------------------

export interface RpgQuestView {
  readonly quest: QuestDef;
  readonly professionRequired: "miner" | "lumber" | null;
}

export function listRpgQuests(): readonly RpgQuestView[] {
  return RPG_QUEST_DEFINITIONS.map((quest) => ({
    quest,
    professionRequired: MINER_QUEST_IDS.has(quest.id)
      ? "miner"
      : LUMBER_QUEST_IDS.has(quest.id)
        ? "lumber"
        : null,
  }));
}
