/**
 * Legacy deterministic crafting recipe shim.
 *
 * New deterministic recipes belong in src/content/packs/default.ts. This file
 * keeps older crafting-engine imports stable while the content registry becomes
 * the canonical source.
 */

import { DEFAULT_CONTENT_PACK } from "@/content/packs/default";
import type { RecipeDef } from "@/content/schemas";

export interface CraftingRecipe {
  readonly id: string;
  readonly ingredients: readonly string[];
  readonly output: { readonly id: string; readonly qty: number };
  readonly method: "transform" | "mixture";
}

const CONTENT_RECIPES = Object.values(DEFAULT_CONTENT_PACK.recipes) as unknown as RecipeDef[];

export const CRAFTING_RECIPES: CraftingRecipe[] = CONTENT_RECIPES
  .filter((recipe) => recipe.type === "crafting")
  .map((recipe) => ({
    id: recipe.id,
    ingredients: recipe.itemInputs.map((input) => input.itemId),
    output: {
      id: recipe.itemOutputs[0]?.itemId ?? "",
      qty: recipe.itemOutputs[0]?.quantity ?? 1,
    },
    method:
      recipe.craftingMethod ??
      (recipe.itemInputs.length === 1 ? "transform" : "mixture"),
  }));
