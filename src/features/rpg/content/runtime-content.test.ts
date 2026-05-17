import { describe, expect, test } from "bun:test";
import { LOCATIONS } from "@/features/rpg/content/locations";
import { MATERIALS } from "@/features/rpg/content/materials";
import { CRAFTING_RECIPES, PROCESSING_RECIPES } from "@/features/rpg/content/recipes";
import { TOOLS } from "@/features/rpg/content/tools";

describe("RPG runtime content", () => {
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
});
