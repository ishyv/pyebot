/**
 * RPG Processing Service.
 *
 * Purpose: Process raw materials into refined materials.
 * Architecture: Plain exported async functions — no classes (except ProcessingError).
 * Dependencies: rpg repository (profile), users repository (inventory + currency),
 *   content registry (processing recipes).
 *
 * Mechanics:
 * - 2 raw materials per batch → 1 refined material per successful batch.
 * - Base 62% success rate per batch; luck adds +1% per 10 levels, capped at +25%.
 * - Processing fee in coins per batch (scales with tier).
 * - Failure consumes inputs, produces nothing.
 *
 * Invariants:
 * - Must have at least materialsPerBatch raw materials in inventory.
 * - Must have enough coins for the fee before processing begins.
 * - Materials are consumed before success is rolled (no refund on failure).
 */

import { OkResult, ErrResult, type Result } from "@/core/result";
import { ensureRpgProfile } from "@/db/repositories/rpg";
import { getUser, updateUserPaths } from "@/db/repositories/users";
import { getContentRegistry } from "@/content/registry";

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class ProcessingError extends Error {
  constructor(
    public readonly code:
      | "PROFILE_NOT_FOUND"
      | "CONTENT_NOT_LOADED"
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
// Types
// ---------------------------------------------------------------------------

export interface ProcessingBatchResult {
  readonly batchNumber: number;
  readonly success: boolean;
  readonly roll: number;
}

export interface ProcessingResult {
  readonly userId: string;
  readonly rawMaterialId: string;
  readonly outputMaterialId: string;
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
// Processing recipes
// ---------------------------------------------------------------------------

interface ProcessingRecipe {
  readonly inputItemId: string;
  readonly outputItemId: string;
  readonly materialsPerBatch: number;
  readonly outputPerBatch: number;
  readonly tier: number;
}

const BASE_SUCCESS_CHANCE = 0.62;
const BASE_FEE_PER_BATCH = 10;
const FEE_TIER_MULTIPLIER = 5;

function getRecipe(rawMaterialId: string): ProcessingRecipe | null {
  const registry = getContentRegistry();
  if (!registry) return null;

  const recipe = registry.findProcessingRecipeByInput(rawMaterialId);
  if (recipe) {
    return {
      inputItemId: rawMaterialId,
      outputItemId: recipe.itemOutputs[0]?.itemId ?? "",
      materialsPerBatch: recipe.itemInputs[0]?.quantity ?? 2,
      outputPerBatch: recipe.itemOutputs[0]?.quantity ?? 1,
      tier: recipe.tierRequirement ?? 1,
    };
  }
  return null;
}

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
  // Validate profile exists
  const profileRes = await ensureRpgProfile(userId);
  if (profileRes.isErr()) {
    return ErrResult(new ProcessingError("PROFILE_NOT_FOUND", "RPG profile not found"));
  }

  // Resolve recipe
  if (!getContentRegistry()) {
    return ErrResult(new ProcessingError("CONTENT_NOT_LOADED", "Content registry is not loaded."));
  }

  const recipe = getRecipe(rawMaterialId);
  if (!recipe) {
    return ErrResult(new ProcessingError("RECIPE_NOT_FOUND", `No processing recipe for "${rawMaterialId}"`));
  }

  const batches = Math.floor(quantity / recipe.materialsPerBatch);
  if (batches < 1) {
    return ErrResult(new ProcessingError(
      "INSUFFICIENT_MATERIALS",
      `Need at least ${recipe.materialsPerBatch} ${rawMaterialId} per batch`,
    ));
  }

  const requiredMaterials = recipe.materialsPerBatch * batches;

  // Check inventory
  const userRes = await getUser(userId);
  if (userRes.isErr() || !userRes.unwrap()) {
    return ErrResult(new ProcessingError("PROFILE_NOT_FOUND", "User not found"));
  }

  const user = userRes.unwrap()!;
  const inventory = user.inventory ?? {};
  const available = (inventory[rawMaterialId] as number | undefined) ?? 0;

  if (available < requiredMaterials) {
    return ErrResult(new ProcessingError(
      "INSUFFICIENT_MATERIALS",
      `Need ${requiredMaterials} ${rawMaterialId}, have ${available}`,
    ));
  }

  // Check fee
  const totalFee = calculateFee(recipe.tier, batches);
  if (totalFee > 0) {
    const balance = (user.currency?.["coins"] as number | undefined) ?? 0;
    if (balance < totalFee) {
      return ErrResult(new ProcessingError(
        "INSUFFICIENT_FUNDS",
        `Need ${totalFee} coins for processing fee, have ${balance}`,
      ));
    }
  }

  // Deduct materials
  const newMaterialQty = available - requiredMaterials;
  const consumePaths: Record<string, unknown> = {
    [`inventory.${rawMaterialId}`]: newMaterialQty > 0 ? newMaterialQty : 0,
  };

  if (totalFee > 0) {
    const oldBalance = (user.currency?.["coins"] as number | undefined) ?? 0;
    consumePaths["currency.coins"] = oldBalance - totalFee;
  }

  const consumeRes = await updateUserPaths(userId, consumePaths);
  if (consumeRes.isErr()) {
    return ErrResult(new ProcessingError("UPDATE_FAILED", "Failed to consume materials"));
  }

  // Roll batches
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
    const currentOutput = (latestInventory[recipe.outputItemId] as number | undefined) ?? 0;
    await updateUserPaths(userId, {
      [`inventory.${recipe.outputItemId}`]: currentOutput + outputGained,
    });
  }

  return OkResult({
    userId,
    rawMaterialId,
    outputMaterialId: recipe.outputItemId,
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
// getProcessingInfo — query without mutating state
// ---------------------------------------------------------------------------

export interface ProcessingInfo {
  readonly canProcess: boolean;
  readonly outputItemId: string | null;
  readonly materialsPerBatch: number;
  readonly successChance: number;
  readonly feePerBatch: number;
}

export function getProcessingInfo(rawMaterialId: string, luckLevel = 0): ProcessingInfo {
  const recipe = getRecipe(rawMaterialId);
  if (!recipe) {
    return { canProcess: false, outputItemId: null, materialsPerBatch: 2, successChance: 0, feePerBatch: 0 };
  }
  return {
    canProcess: true,
    outputItemId: recipe.outputItemId,
    materialsPerBatch: recipe.materialsPerBatch,
    successChance: calculateSuccessChance(luckLevel),
    feePerBatch: calculateFee(recipe.tier, 1),
  };
}
