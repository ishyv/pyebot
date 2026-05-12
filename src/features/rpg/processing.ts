/**
 * RPG Processing Service.
 *
 * Turn raw materials into refined ones in batches. Recipes are typed compile-time
 * constants in `content/recipes.ts`; this service is pure mechanics:
 *   - 2 raw → 1 refined per batch
 *   - base 62% success per batch; +1% per luck level (capped +25%)
 *   - flat coin fee per batch scaling with tier
 *   - materials are consumed before the success roll; failure produces nothing
 */

import { OkResult, ErrResult, type Result } from "@/core/result";
import { ensureRpgProfile } from "@/db/repositories/rpg";
import { getUser, updateUserPaths } from "@/db/repositories/users";
import {
  PROCESSING_RECIPES,
  parseProcessingInputId,
  type ProcessingInputId,
} from "@/features/rpg/content/recipes";
import type { MaterialId } from "@/features/rpg/content/materials";

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class ProcessingError extends Error {
  constructor(
    public readonly code:
      | "PROFILE_NOT_FOUND"
      | "RECIPE_NOT_FOUND"
      | "INSUFFICIENT_MATERIALS"
      | "INSUFFICIENT_FUNDS"
      | "UPDATE_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "ProcessingError";
  }
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface ProcessingBatchResult {
  readonly batchNumber: number;
  readonly success: boolean;
  readonly roll: number;
}

export interface ProcessingResult {
  readonly userId: string;
  readonly rawMaterialId: ProcessingInputId;
  readonly outputMaterialId: MaterialId;
  readonly batchesAttempted: number;
  readonly batchesSucceeded: number;
  readonly batchesFailed: number;
  readonly materialsConsumed: number;
  readonly outputGained: number;
  readonly feePaid: number;
  readonly successChance: number;
  readonly batches: readonly ProcessingBatchResult[];
}

// ---------------------------------------------------------------------------
// Tuning
// ---------------------------------------------------------------------------

const BASE_SUCCESS_CHANCE = 0.62;
const BASE_FEE_PER_BATCH = 10;
const FEE_TIER_MULTIPLIER = 5;

function calculateSuccessChance(luckLevel: number): number {
  const luckBonus = Math.min(0.25, luckLevel * 0.01);
  return Math.min(1.0, BASE_SUCCESS_CHANCE + luckBonus);
}

function calculateFee(tier: number, batches: number): number {
  return (BASE_FEE_PER_BATCH + (tier - 1) * FEE_TIER_MULTIPLIER) * batches;
}

// ---------------------------------------------------------------------------
// process
// ---------------------------------------------------------------------------

export async function process(
  userId: string,
  rawMaterialId: string,
  quantity: number,
  options: { luckLevel?: number } = {},
): Promise<Result<ProcessingResult, ProcessingError>> {
  const profileRes = await ensureRpgProfile(userId);
  if (profileRes.isErr()) {
    return ErrResult(new ProcessingError("PROFILE_NOT_FOUND", "RPG profile not found"));
  }

  const recipeId = parseProcessingInputId(rawMaterialId);
  if (!recipeId) {
    return ErrResult(new ProcessingError("RECIPE_NOT_FOUND", `No processing recipe for "${rawMaterialId}"`));
  }
  const recipe = PROCESSING_RECIPES[recipeId];

  const batches = Math.floor(quantity / recipe.materialsPerBatch);
  if (batches < 1) {
    return ErrResult(
      new ProcessingError(
        "INSUFFICIENT_MATERIALS",
        `Need at least ${recipe.materialsPerBatch} ${recipeId} per batch`,
      ),
    );
  }

  const requiredMaterials = recipe.materialsPerBatch * batches;

  const userRes = await getUser(userId);
  if (userRes.isErr() || !userRes.unwrap()) {
    return ErrResult(new ProcessingError("PROFILE_NOT_FOUND", "User not found"));
  }
  const user = userRes.unwrap()!;
  const inventory = user.inventory ?? {};
  const available = (inventory[recipeId] as number | undefined) ?? 0;

  if (available < requiredMaterials) {
    return ErrResult(
      new ProcessingError(
        "INSUFFICIENT_MATERIALS",
        `Need ${requiredMaterials} ${recipeId}, have ${available}`,
      ),
    );
  }

  const totalFee = calculateFee(recipe.tier, batches);
  const oldBalance = (user.currency?.["coins"] as number | undefined) ?? 0;
  if (totalFee > oldBalance) {
    return ErrResult(
      new ProcessingError(
        "INSUFFICIENT_FUNDS",
        `Need ${totalFee} coins for processing fee, have ${oldBalance}`,
      ),
    );
  }

  // Consume materials (+ fee in one update)
  const consumePaths: Record<string, unknown> = {
    [`inventory.${recipeId}`]: Math.max(0, available - requiredMaterials),
  };
  if (totalFee > 0) {
    consumePaths["currency.coins"] = oldBalance - totalFee;
  }

  const consumeRes = await updateUserPaths(userId, consumePaths);
  if (consumeRes.isErr()) {
    return ErrResult(new ProcessingError("UPDATE_FAILED", "Failed to consume materials"));
  }

  // Roll
  const luckLevel = options.luckLevel ?? 0;
  const successChance = calculateSuccessChance(luckLevel);
  const batchResults: ProcessingBatchResult[] = [];
  let successes = 0;

  for (let i = 0; i < batches; i++) {
    const roll = Math.random();
    const success = roll < successChance;
    batchResults.push({ batchNumber: i + 1, success, roll });
    if (success) successes++;
  }

  // Grant output
  const outputGained = successes * recipe.outputPerBatch;
  if (outputGained > 0) {
    const latestUserRes = await getUser(userId);
    const latestInventory = (latestUserRes.isOk() ? latestUserRes.unwrap()?.inventory : undefined) ?? {};
    const currentOutput = (latestInventory[recipe.output] as number | undefined) ?? 0;
    await updateUserPaths(userId, {
      [`inventory.${recipe.output}`]: currentOutput + outputGained,
    });
  }

  return OkResult({
    userId,
    rawMaterialId: recipeId,
    outputMaterialId: recipe.output,
    batchesAttempted: batches,
    batchesSucceeded: successes,
    batchesFailed: batches - successes,
    materialsConsumed: requiredMaterials,
    outputGained,
    feePaid: totalFee,
    successChance,
    batches: batchResults,
  });
}

// ---------------------------------------------------------------------------
// getProcessingInfo — read-only metadata used by UI hints
// ---------------------------------------------------------------------------

export interface ProcessingInfo {
  readonly canProcess: boolean;
  readonly outputItemId: MaterialId | null;
  readonly materialsPerBatch: number;
  readonly successChance: number;
  readonly feePerBatch: number;
}

export function getProcessingInfo(rawMaterialId: string, luckLevel = 0): ProcessingInfo {
  const recipeId = parseProcessingInputId(rawMaterialId);
  if (!recipeId) {
    return { canProcess: false, outputItemId: null, materialsPerBatch: 2, successChance: 0, feePerBatch: 0 };
  }
  const recipe = PROCESSING_RECIPES[recipeId];
  return {
    canProcess: true,
    outputItemId: recipe.output,
    materialsPerBatch: recipe.materialsPerBatch,
    successChance: calculateSuccessChance(luckLevel),
    feePerBatch: calculateFee(recipe.tier, 1),
  };
}
