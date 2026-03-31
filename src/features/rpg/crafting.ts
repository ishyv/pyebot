/**
 * RPG Crafting Service.
 *
 * Purpose: Recipe-based item crafting — consume materials from inventory,
 * produce a crafted item.
 *
 * Architecture: Plain exported async functions — no classes (except CraftingError).
 * Dependencies: users repository (inventory reads/writes via updateUserPaths).
 *
 * Flow:
 *   craft → look up recipe → fetch user → check materials → deduct + grant item
 *
 * Invariants:
 * - Inventory items are stored as numeric quantities at `inventory.<itemId>`.
 * - Materials are deducted atomically via updateUserPaths dot-notation.
 * - Quantity must be >= 1.
 */

import { OkResult, ErrResult, type Result } from "@/core/result";
import { getUser, updateUserPaths } from "@/db/repositories/users";

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
// Recipes
// ---------------------------------------------------------------------------

export const RECIPES: Record<string, { requires: Record<string, number> }> = {
  stone_pickaxe:  { requires: { stone: 3 } },
  copper_pickaxe: { requires: { copper_ingot: 3 } },
  iron_pickaxe:   { requires: { iron_ingot: 3 } },
  stone_axe:      { requires: { oak_plank: 3 } },
  copper_axe:     { requires: { copper_ingot: 3 } },
  iron_axe:       { requires: { iron_ingot: 3 } },
};

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface CraftingResult {
  itemId: string;
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

  // 1. Look up recipe
  const recipe = RECIPES[itemId];
  if (!recipe) {
    return ErrResult(new CraftingError("RECIPE_NOT_FOUND", `No recipe for ${itemId}`));
  }

  // 2. Fetch user
  const userRes = await getUser(userId);
  if (userRes.isErr()) {
    return ErrResult(new CraftingError("USER_NOT_FOUND", `User ${userId} not found`));
  }
  const user = userRes.unwrap();
  if (!user) {
    return ErrResult(new CraftingError("USER_NOT_FOUND", `User ${userId} not found`));
  }

  // 3. Get inventory (top-level inventory field on User)
  const inventory: Record<string, number> = {};
  const rawInventory = user.inventory ?? {};
  for (const [k, v] of Object.entries(rawInventory)) {
    inventory[k] = typeof v === "number" ? v : 0;
  }

  // 4. Check materials
  for (const [material, required] of Object.entries(recipe.requires)) {
    const needed = required * quantity;
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

  // 5. Build path updates: deduct ingredients, add crafted item
  const paths: Record<string, number> = {};
  const materialsConsumed: Record<string, number> = {};

  for (const [material, required] of Object.entries(recipe.requires)) {
    const needed = required * quantity;
    paths[`inventory.${material}`] = (inventory[material] ?? 0) - needed;
    materialsConsumed[material] = needed;
  }

  paths[`inventory.${itemId}`] = (inventory[itemId] ?? 0) + quantity;

  const updateRes = await updateUserPaths(userId, paths);
  if (updateRes.isErr()) {
    return ErrResult(new CraftingError("UPDATE_FAILED", "Failed to update inventory"));
  }

  // 6. Return success
  return OkResult({ itemId, quantity, materialsConsumed });
}
