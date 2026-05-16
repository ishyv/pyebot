/**
 * Static recipe catalogs.
 *
 * `CRAFTING_RECIPES` — input materials → produced item. Drives `/craft`.
 *   Keys correspond to crafted item IDs (a subset of ToolId today).
 * `PROCESSING_RECIPES` — raw material → refined material in batches. Drives `/process`.
 *   Keys correspond to the input MaterialId.
 *
 * `Partial<Record<MaterialId, number>>` on `requires` catches typo'd material IDs
 * at compile time without dragging Zod into the domain layer.
 */

import type { MaterialId } from "./materials";

export interface CraftingRecipeDef {
  readonly requires: Readonly<Partial<Record<MaterialId, number>>>;
}

export const CRAFTING_RECIPES = {
  stone_pickaxe: { requires: { stone: 3 } },
  copper_pickaxe: { requires: { copper_ingot: 3 } },
  iron_pickaxe: { requires: { iron_ingot: 3 } },
  stone_axe: { requires: { oak_plank: 3 } },
  copper_axe: { requires: { copper_ingot: 3 } },
  iron_axe: { requires: { iron_ingot: 3 } },
} as const satisfies Record<string, CraftingRecipeDef>;

export type CraftingRecipeId = keyof typeof CRAFTING_RECIPES;

/** Untrusted-string boundary helper for /craft. */
export function parseCraftingRecipeId(value: string | null | undefined): CraftingRecipeId | null {
  return value && value in CRAFTING_RECIPES ? (value as CraftingRecipeId) : null;
}

export interface ProcessingRecipeDef {
  readonly output: MaterialId;
  readonly materialsPerBatch: number;
  readonly outputPerBatch: number;
  readonly tier: 1 | 2 | 3 | 4;
}

export const PROCESSING_RECIPES = {
  stone: { output: "stone_block", materialsPerBatch: 2, outputPerBatch: 1, tier: 1 },
  copper_ore: { output: "copper_ingot", materialsPerBatch: 2, outputPerBatch: 1, tier: 2 },
  iron_ore: { output: "iron_ingot", materialsPerBatch: 2, outputPerBatch: 1, tier: 3 },
  silver_ore: { output: "silver_ingot", materialsPerBatch: 2, outputPerBatch: 1, tier: 4 },
  oak_wood: { output: "oak_plank", materialsPerBatch: 2, outputPerBatch: 1, tier: 1 },
  spruce_wood: { output: "spruce_plank", materialsPerBatch: 2, outputPerBatch: 1, tier: 2 },
  palm_wood: { output: "palm_plank", materialsPerBatch: 2, outputPerBatch: 1, tier: 3 },
  pine_wood: { output: "pine_plank", materialsPerBatch: 2, outputPerBatch: 1, tier: 4 },
} as const satisfies Record<string, ProcessingRecipeDef>;

/** A processing recipe is indexed by its raw-input MaterialId. */
export type ProcessingInputId = keyof typeof PROCESSING_RECIPES;

/** Untrusted-string boundary helper for /process. */
export function parseProcessingInputId(value: string | null | undefined): ProcessingInputId | null {
  return value && value in PROCESSING_RECIPES ? (value as ProcessingInputId) : null;
}
