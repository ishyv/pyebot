/**
 * Crafting facade used by RPG commands.
 *
 * Deterministic recipes come from the loaded typed content registry. Three-item
 * unknown combinations are delegated to active Crucible alchemy.
 */

import type { SourcedRecipeDef } from "@/content/loader";
import { getContentRegistry } from "@/content/registry";
import { ErrResult, OkResult, type Result } from "@/core/result";
import { craftInCrucible } from "./alchemy";

export interface CraftingResult {
  outputId: string;
  outputName: string;
  qty: number;
  method: "transform" | "mixture" | "alchemy";
  isNewDiscovery?: boolean;
}

export type CraftingError = {
  code: "MISSING_ITEMS" | "UNKNOWN_ITEM" | "INVALID_COMBO" | "ENGINE_ERROR";
  message: string;
};

const craftingOk = (result: CraftingResult): Result<CraftingResult, CraftingError> =>
  OkResult<CraftingResult, CraftingError>(result);

const craftingErr = (error: CraftingError): Result<CraftingResult, CraftingError> =>
  ErrResult<CraftingResult, CraftingError>(error);

type DeterministicRecipe = {
  readonly id: string;
  readonly ingredients: readonly string[];
  readonly output: { readonly id: string; readonly qty: number };
  readonly method: "transform" | "mixture";
};

function toDeterministicRecipe(recipe: SourcedRecipeDef): DeterministicRecipe {
  return {
    id: recipe.id,
    ingredients: recipe.itemInputs.map((input) => input.itemId),
    output: {
      id: recipe.itemOutputs[0]?.itemId ?? "",
      qty: recipe.itemOutputs[0]?.quantity ?? 1,
    },
    method: recipe.itemInputs.length === 1 ? "transform" : "mixture",
  };
}

function listDeterministicRecipes(): readonly DeterministicRecipe[] | null {
  const registry = getContentRegistry();
  if (!registry) return null;
  return registry.listRecipesByType("crafting").map(toDeterministicRecipe);
}

function getOutputItemName(itemId: string): string | null {
  return getContentRegistry()?.getItem(itemId)?.name ?? null;
}

/**
 * The core engine that handles all crafting in Ashenmoor.
 */
export async function craftItems(
  userId: string,
  itemIds: string[],
): Promise<Result<CraftingResult, CraftingError>> {
  if (itemIds.length < 1 || itemIds.length > 3) {
    return craftingErr({
      code: "INVALID_COMBO",
      message: "You must provide between 1 and 3 items.",
    });
  }

  // Sort item IDs to ensure consistency for lookups
  const sortedInputs = [...itemIds].sort();
  const deterministicRecipes = listDeterministicRecipes();
  if (!deterministicRecipes) {
    return craftingErr({
      code: "ENGINE_ERROR",
      message: "Content registry is not loaded.",
    });
  }

  // 1. Check for deterministic recipes
  const recipe = deterministicRecipes.find((r) => {
    if (r.ingredients.length !== sortedInputs.length) return false;
    const sortedRecipeInputs = [...r.ingredients].sort();
    return sortedRecipeInputs.every((val, index) => val === sortedInputs[index]);
  });

  if (recipe) {
    const outputName = getOutputItemName(recipe.output.id);
    if (!outputName) {
      return craftingErr({
        code: "ENGINE_ERROR",
        message: `Recipe output ${recipe.output.id} not found in registry.`,
      });
    }

    // TODO: Actually consume items from inventory here in a real implementation
    // For now, we assume the caller handles inventory or we're just calculating the result.

    return craftingOk({
      outputId: recipe.output.id,
      outputName,
      qty: recipe.output.qty,
      method: recipe.method,
    });
  }

  // 2. Fallback to AI Alchemy for 3-item combinations
  if (sortedInputs.length === 3) {
    const alchemyResult = await craftInCrucible(
      userId,
      sortedInputs[0],
      sortedInputs[1],
      sortedInputs[2],
    );

    if (alchemyResult.isErr()) {
      const code =
        alchemyResult.error.code === "AI_ERROR" ? "ENGINE_ERROR" : alchemyResult.error.code;

      return craftingErr({
        code,
        message: alchemyResult.error.message,
      });
    }

    const data = alchemyResult.value;
    return craftingOk({
      outputId: data.outputId,
      outputName: data.outputName,
      qty: 1,
      method: "alchemy",
      isNewDiscovery: data.isNewDiscovery,
    });
  }

  // 3. 1 or 2 items with no recipe
  return craftingErr({
    code: "INVALID_COMBO",
    message:
      "These items do not seem to have a base transformation or mixture. Try adding a third ingredient for the Crucible.",
  });
}
