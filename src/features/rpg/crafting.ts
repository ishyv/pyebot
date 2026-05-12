/**
 * RPG Crafting Service.
 *
 * Consumes materials from inventory, produces a crafted item. The recipe
 * catalog lives in `content/recipes.ts`; here we narrow the requested item ID,
 * check inventory, and apply the deduction + grant in one atomic update.
 *
 * Inventory items are stored as numeric quantities at `inventory.<itemId>`.
 */

import { OkResult, ErrResult, type Result } from "@/core/result";
import { getUser, updateUserPaths } from "@/db/repositories/users";
import {
  CRAFTING_RECIPES,
  parseCraftingRecipeId,
  type CraftingRecipeId,
} from "@/features/rpg/content/recipes";

// Re-export for callers that need to enumerate or autocomplete recipes.
export { CRAFTING_RECIPES, type CraftingRecipeId };

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export type CraftingErrorCode =
  | "RECIPE_NOT_FOUND"
  | "INSUFFICIENT_MATERIALS"
  | "USER_NOT_FOUND"
  | "UPDATE_FAILED";

export class CraftingError extends Error {
  readonly code: CraftingErrorCode;

  constructor(code: CraftingErrorCode, message: string) {
    super(message);
    this.name = "CraftingError";
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface CraftingResult {
  itemId: CraftingRecipeId;
  quantity: number;
  materialsConsumed: Record<string, number>;
}

// ---------------------------------------------------------------------------
// craft
// ---------------------------------------------------------------------------

export async function craft(
  userId: string,
  itemId: string,
  quantity: number = 1,
): Promise<Result<CraftingResult, CraftingError>> {
  if (quantity < 1) {
    return ErrResult(new CraftingError("RECIPE_NOT_FOUND", "Quantity must be >= 1"));
  }

  const recipeId = parseCraftingRecipeId(itemId);
  if (!recipeId) {
    return ErrResult(new CraftingError("RECIPE_NOT_FOUND", `No recipe for ${itemId}`));
  }
  const recipe = CRAFTING_RECIPES[recipeId];

  const userRes = await getUser(userId);
  if (userRes.isErr()) {
    return ErrResult(new CraftingError("USER_NOT_FOUND", `User ${userId} not found`));
  }
  const user = userRes.unwrap();
  if (!user) {
    return ErrResult(new CraftingError("USER_NOT_FOUND", `User ${userId} not found`));
  }

  // Coerce inventory values to numbers (Mongo can return mixed types from old rows).
  const inventory: Record<string, number> = {};
  for (const [k, v] of Object.entries(user.inventory ?? {})) {
    inventory[k] = typeof v === "number" ? v : 0;
  }

  for (const [material, required] of Object.entries(recipe.requires)) {
    const needed = (required ?? 0) * quantity;
    const have = inventory[material] ?? 0;
    if (have < needed) {
      return ErrResult(
        new CraftingError(
          "INSUFFICIENT_MATERIALS",
          `Need ${needed}x ${material} — you have ${have}x`,
        ),
      );
    }
  }

  const paths: Record<string, number> = {};
  const materialsConsumed: Record<string, number> = {};

  for (const [material, required] of Object.entries(recipe.requires)) {
    const needed = (required ?? 0) * quantity;
    paths[`inventory.${material}`] = (inventory[material] ?? 0) - needed;
    materialsConsumed[material] = needed;
  }

  paths[`inventory.${recipeId}`] = (inventory[recipeId] ?? 0) + quantity;

  const updateRes = await updateUserPaths(userId, paths);
  if (updateRes.isErr()) {
    return ErrResult(new CraftingError("UPDATE_FAILED", "Failed to update inventory"));
  }

  return OkResult({ itemId: recipeId, quantity, materialsConsumed });
}
