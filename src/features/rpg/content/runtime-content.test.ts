import { afterEach, describe, expect, test } from "bun:test";
import { LOCATIONS, locationsForAction, parseLocationId } from "@/features/rpg/content/locations";
import { MATERIALS } from "@/features/rpg/content/materials";
import {
  CRAFTING_RECIPES,
  PROCESSING_RECIPES,
  parseCraftingRecipeId,
} from "@/features/rpg/content/recipes";
import {
  getRpgContentSnapshot,
  replaceRpgContentForTest,
  resetRpgContentForTest,
} from "@/features/rpg/content/runtime";
import { TOOLS } from "@/features/rpg/content/tools";

describe("RPG runtime content", () => {
  afterEach(() => {
    resetRpgContentForTest();
  });

  test("locations only reference runtime materials", () => {
    for (const [locationId, location] of Object.entries(LOCATIONS)) {
      for (const materialId of location.materials) {
        expect(materialId in MATERIALS, `${locationId} references ${materialId}`).toBe(true);
      }
    }
  });

  test("processing recipes only reference runtime materials", () => {
    for (const [inputId, recipe] of Object.entries(PROCESSING_RECIPES)) {
      expect(inputId in MATERIALS, `processing input ${inputId}`).toBe(true);
      expect(recipe.output in MATERIALS, `processing output ${recipe.output}`).toBe(true);
    }
  });

  test("crafting recipes consume runtime materials and produce known tools", () => {
    for (const [recipeId, recipe] of Object.entries(CRAFTING_RECIPES)) {
      expect(recipeId in TOOLS, `crafting output ${recipeId}`).toBe(true);

      for (const materialId of Object.keys(recipe.requires)) {
        expect(materialId in MATERIALS, `${recipeId} requires ${materialId}`).toBe(true);
      }
    }
  });

  test("valid reloads atomically update gathering location lookups", () => {
    const before = getRpgContentSnapshot();
    const result = replaceRpgContentForTest({
      ...before,
      locations: {
        ...before.locations,
        test_mine: {
          id: "test_mine",
          name: "Test Mine",
          action: "mine",
          requiredTier: 1,
          materials: ["stone"],
        },
      },
    });

    expect(result.isOk()).toBe(true);
    expect(parseLocationId("test_mine")).toBe("test_mine");
    expect(locationsForAction("mine").map((location) => location.id)).toContain("test_mine");
  });

  test("invalid reloads leave the active content unchanged", () => {
    const before = getRpgContentSnapshot();
    const result = replaceRpgContentForTest({
      ...before,
      locations: {
        bad_mine: {
          id: "bad_mine",
          name: "Bad Mine",
          action: "mine",
          requiredTier: 1,
          materials: ["missing_material"],
        },
      },
    });

    expect(result.isErr()).toBe(true);
    expect(parseLocationId("bad_mine")).toBeNull();
    expect(getRpgContentSnapshot().locations).toEqual(before.locations);
  });

  test("valid reloads update craft recipe autocomplete sources", () => {
    const before = getRpgContentSnapshot();
    const result = replaceRpgContentForTest({
      ...before,
      tools: {
        ...before.tools,
        test_pickaxe: {
          name: "Test Pickaxe",
          kind: "pickaxe",
          tier: 1,
          startingDurability: 5,
        },
      },
      craftingRecipes: {
        ...before.craftingRecipes,
        test_pickaxe: { requires: { stone: 1 } },
      },
    });

    expect(result.isOk()).toBe(true);
    expect(parseCraftingRecipeId("test_pickaxe")).toBe("test_pickaxe");
    expect(Object.keys(CRAFTING_RECIPES)).toContain("test_pickaxe");
  });
});
