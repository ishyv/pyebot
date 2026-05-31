/**
 * Live recipe catalogs.
 *
 * Dashboard reloads replace these maps in place after validation. The keys
 * remain runtime strings because author-authored content can add recipes
 * without a TypeScript rebuild.
 *
 * Processing recipes are keyed by input material, not by recipe ID. Crafting
 * recipes are keyed by output tool. Those shapes are intentionally different
 * because commands start from different user choices.
 */

import type { MaterialId } from "./materials";
import {
  type RuntimeCraftingRecipeDef,
  type RuntimeProcessingRecipeDef,
  runtimeCraftingRecipes,
  runtimeProcessingRecipes,
} from "./runtime";

export type CraftingRecipeDef = RuntimeCraftingRecipeDef;

export const CRAFTING_RECIPES = runtimeCraftingRecipes;

/** Runtime crafting recipe ID after `parseCraftingRecipeId` succeeds. */
export type CraftingRecipeId = string;

/** Untrusted-string boundary helper for /craft. */
export function parseCraftingRecipeId(value: string | null | undefined): CraftingRecipeId | null {
  return value && value in CRAFTING_RECIPES ? (value as CraftingRecipeId) : null;
}

export interface ProcessingRecipeDef extends RuntimeProcessingRecipeDef {
  readonly output: MaterialId;
  readonly materialsPerBatch: number;
  readonly outputPerBatch: number;
  readonly tier: 1 | 2 | 3 | 4;
}

export const PROCESSING_RECIPES = runtimeProcessingRecipes as Record<string, ProcessingRecipeDef>;

/** A processing recipe is indexed by its raw-input MaterialId. */
export type ProcessingInputId = string;

/** Untrusted-string boundary helper for /process. */
export function parseProcessingInputId(value: string | null | undefined): ProcessingInputId | null {
  return value && value in PROCESSING_RECIPES ? (value as ProcessingInputId) : null;
}
