import { describe, expect, test } from "bun:test";
import { ContentValidationError, type LoadedContent, validateLoadedContent } from "./validation";

function source(kind: string, id: string) {
  return { file: "test-pack", jsonPath: `$.${kind}.${id}` };
}

function validContent(): LoadedContent {
  return {
    packDir: "test-pack",
    items: [
      {
        id: "stone",
        name: "Stone",
        category: "mineral",
        rarity: "common",
        trait1: "Density",
        trait2: "None",
        sources: ["gather"],
        description: "A stone.",
        __source: source("items", "stone"),
      },
      {
        id: "sharp_stone",
        name: "Sharp Stone",
        category: "component",
        rarity: "common",
        trait1: "Sharpness",
        trait2: "None",
        sources: ["craft"],
        description: "A sharper stone.",
        __source: source("items", "sharp_stone"),
      },
    ],
    recipes: [
      {
        id: "sharpen_stone",
        name: "Sharpen Stone",
        description: "Make a sharp stone.",
        type: "crafting",
        itemInputs: [{ itemId: "stone", quantity: 1 }],
        itemOutputs: [{ itemId: "sharp_stone", quantity: 1 }],
        xpReward: 0,
        enabled: true,
        __source: source("recipes", "sharpen_stone"),
      },
    ],
    dropTables: [],
    locations: [
      {
        id: "stone_mine",
        name: "Stone Mine",
        action: "mine",
        profession: "miner",
        requiredTier: 1,
        materials: ["stone"],
        __source: source("locations", "stone_mine"),
      },
    ],
  };
}

describe("validateLoadedContent", () => {
  test("accepts sourced content with known item references", () => {
    expect(() => validateLoadedContent(validContent())).not.toThrow();
  });

  test("reports unknown recipe item references", () => {
    const content = validContent();
    const badContent: LoadedContent = {
      ...content,
      recipes: [
        {
          ...content.recipes[0],
          itemOutputs: [{ itemId: "missing_item", quantity: 1 }],
        },
      ],
    };

    expect(() => validateLoadedContent(badContent)).toThrow(ContentValidationError);
  });
});
