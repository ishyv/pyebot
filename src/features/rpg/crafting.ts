/**
 * RPG Crafting Service.
 *
 * Consumes materials from inventory, produces a crafted item. The recipe
 * catalog lives in `content/recipes.ts`; here we narrow the requested item ID,
 * check inventory, and apply the deduction + grant in one atomic update.
 *
 * Inventory items are stored as stack slots in the `UserInventory` component.
 */

import { ErrResult, OkResult, type Result } from "@/core/result";
import {
  CRAFTING_RECIPES,
  type CraftingRecipeId,
  parseCraftingRecipeId,
} from "@/features/rpg/content/recipes";
import { addStackItems, getStackQuantity, removeStackItems } from "@/features/rpg/inventory";
import type { Ctx } from "@/framework/types";

// Re-export for callers that need to enumerate or autocomplete recipes.
export { CRAFTING_RECIPES, type CraftingRecipeId };

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export type CraftingErrorCode = "RECIPE_NOT_FOUND" | "INSUFFICIENT_MATERIALS" | "UPDATE_FAILED";

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
  ctx: Ctx,
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

  for (const [material, required] of Object.entries(recipe.requires)) {
    const needed = (required ?? 0) * quantity;
    const have = await getStackQuantity(ctx, userId, material);
    if (have < needed) {
      return ErrResult(
        new CraftingError(
          "INSUFFICIENT_MATERIALS",
          `Need ${needed}x ${material} — you have ${have}x`,
        ),
      );
    }
  }

  const materialsConsumed: Record<string, number> = {};
  const requiredItems: Record<string, number> = {};

  for (const [material, required] of Object.entries(recipe.requires)) {
    const needed = (required ?? 0) * quantity;
    requiredItems[material] = needed;
    materialsConsumed[material] = needed;
  }

  const removeRes = await removeStackItems(ctx, userId, requiredItems);
  if (removeRes.isErr()) {
    return ErrResult(new CraftingError("UPDATE_FAILED", removeRes.error.message));
  }

  try {
    await addStackItems(ctx, userId, { [recipeId]: quantity });
  } catch {
    await addStackItems(ctx, userId, requiredItems).catch(() => {});
    return ErrResult(new CraftingError("UPDATE_FAILED", "Failed to update inventory"));
  }

  return OkResult({ itemId: recipeId, quantity, materialsConsumed });
}
