import { describe, test, expect, beforeEach } from "bun:test";
import {
  ContentIdSchema,
  ItemDefSchema,
  RecipeDefSchema,
  DropTableDefSchema,
  LocationDefSchema,
} from "@/content/schemas";
import {
  validateLoadedContent,
  ContentValidationError,
  type ValidationContext,
} from "@/content/validation";
import {
  getContentRegistry,
  resetContentRegistryForTests,
  buildRegistryFromPacks,
} from "@/content/registry";
import type { LoadedContentPacks, SourcedItemDef, SourcedRecipeDef, SourcedDropTableDef, SourcedLocationDef } from "@/content/loader";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSrc(file: string, jsonPath: string) {
  return { __source: { file, jsonPath } };
}

function makeItem(id: string, overrides: Record<string, unknown> = {}): SourcedItemDef {
  return {
    id,
    name: `Item ${id}`,
    description: `Description for ${id}`,
    ...makeSrc("test.json", `$.items[0]`),
    ...overrides,
  } as SourcedItemDef;
}

function makeRecipe(id: string, inputId: string, outputId: string, overrides: Record<string, unknown> = {}): SourcedRecipeDef {
  return {
    id,
    name: `Recipe ${id}`,
    description: `Recipe description`,
    type: "crafting",
    itemInputs: [{ itemId: inputId, quantity: 1 }],
    itemOutputs: [{ itemId: outputId, quantity: 1 }],
    xpReward: 0,
    enabled: true,
    ...makeSrc("recipes.json", `$.recipes[0]`),
    ...overrides,
  } as SourcedRecipeDef;
}

function makeDropTable(id: string, itemId: string, locationId?: string): SourcedDropTableDef {
  return {
    id,
    action: "mine",
    tier: 1,
    entries: [{ itemId, chance: 1, weight: 1, minQty: 1 }],
    ...(locationId ? { locationId } : {}),
    ...makeSrc("drop_tables.json", `$.dropTables[0]`),
  } as SourcedDropTableDef;
}

function makeLocation(id: string, overrides: Record<string, unknown> = {}): SourcedLocationDef {
  return {
    id,
    name: `Location ${id}`,
    action: "mine",
    profession: "miner",
    requiredTier: 1,
    materials: [],
    ...makeSrc("locations.json", `$.locations[0]`),
    ...overrides,
  } as SourcedLocationDef;
}

function makePacks(overrides: Partial<LoadedContentPacks> = {}): LoadedContentPacks {
  return {
    packDir: "/test",
    items: [],
    recipes: [],
    dropTables: [],
    locations: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// schemas.ts tests
// ---------------------------------------------------------------------------

describe("ContentIdSchema", () => {
  test("valid id passes", () => {
    const result = ContentIdSchema.safeParse("iron_ore");
    expect(result.success).toBe(true);
  });

  test("valid id with numbers passes", () => {
    const result = ContentIdSchema.safeParse("iron_ore_2");
    expect(result.success).toBe(true);
  });

  test("invalid id with uppercase fails", () => {
    const result = ContentIdSchema.safeParse("Iron_Ore");
    expect(result.success).toBe(false);
  });

  test("invalid id with spaces fails", () => {
    const result = ContentIdSchema.safeParse("iron ore");
    expect(result.success).toBe(false);
  });

  test("invalid id with hyphen fails", () => {
    const result = ContentIdSchema.safeParse("iron-ore");
    expect(result.success).toBe(false);
  });
});

describe("ItemDefSchema", () => {
  test("valid minimal item parses correctly", () => {
    const result = ItemDefSchema.safeParse({
      id: "iron_ore",
      name: "Iron Ore",
      description: "A chunk of iron ore.",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe("iron_ore");
      expect(result.data.name).toBe("Iron Ore");
    }
  });

  test("valid item with optional fields parses correctly", () => {
    const result = ItemDefSchema.safeParse({
      id: "iron_ore",
      name: "Iron Ore",
      description: "A chunk of iron ore.",
      maxStack: 100,
      weight: 1.5,
      canStack: true,
      value: 10,
      market: {
        tradable: true,
        category: "materials",
        suggestedPrice: 50,
      },
    });
    expect(result.success).toBe(true);
  });

  test("missing required name field fails", () => {
    const result = ItemDefSchema.safeParse({
      id: "iron_ore",
      description: "A chunk of iron ore.",
    });
    expect(result.success).toBe(false);
  });

  test("missing required description field fails", () => {
    const result = ItemDefSchema.safeParse({
      id: "iron_ore",
      name: "Iron Ore",
    });
    expect(result.success).toBe(false);
  });

  test("extra unknown field fails (strict)", () => {
    const result = ItemDefSchema.safeParse({
      id: "iron_ore",
      name: "Iron Ore",
      description: "A chunk.",
      unknownField: true,
    });
    expect(result.success).toBe(false);
  });
});

describe("RecipeDefSchema", () => {
  test("valid recipe with default type parses correctly", () => {
    const result = RecipeDefSchema.safeParse({
      id: "smelt_iron",
      name: "Smelt Iron",
      description: "Smelt iron ore into iron bars.",
      itemInputs: [{ itemId: "iron_ore", quantity: 2 }],
      itemOutputs: [{ itemId: "iron_bar", quantity: 1 }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      // default type should be "crafting"
      expect(result.data.type).toBe("crafting");
      expect(result.data.xpReward).toBe(0);
      expect(result.data.enabled).toBe(true);
    }
  });

  test("recipe with explicit processing type parses correctly", () => {
    const result = RecipeDefSchema.safeParse({
      id: "process_ore",
      name: "Process Ore",
      description: "Process raw ore.",
      type: "processing",
      itemInputs: [{ itemId: "raw_ore", quantity: 1 }],
      itemOutputs: [{ itemId: "ore_dust", quantity: 3 }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("processing");
    }
  });

  test("recipe missing itemInputs fails", () => {
    const result = RecipeDefSchema.safeParse({
      id: "bad_recipe",
      name: "Bad Recipe",
      description: "Missing inputs.",
      itemOutputs: [{ itemId: "iron_bar", quantity: 1 }],
    });
    expect(result.success).toBe(false);
  });
});

describe("DropTableDefSchema", () => {
  test("valid drop table parses correctly", () => {
    const result = DropTableDefSchema.safeParse({
      id: "forest_t1",
      action: "forest",
      tier: 1,
      entries: [
        { itemId: "oak_log", chance: 0.8, weight: 2, minQty: 1, maxQty: 3 },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.entries[0]?.itemId).toBe("oak_log");
    }
  });

  test("drop table with empty entries fails", () => {
    const result = DropTableDefSchema.safeParse({
      id: "empty_table",
      action: "mine",
      tier: 1,
      entries: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("LocationDefSchema", () => {
  test("valid location parses correctly", () => {
    const result = LocationDefSchema.safeParse({
      id: "iron_mine",
      name: "Iron Mine",
      action: "mine",
      profession: "miner",
      requiredTier: 1,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.materials).toEqual([]);
    }
  });

  test("location with materials array parses correctly", () => {
    const result = LocationDefSchema.safeParse({
      id: "iron_mine",
      name: "Iron Mine",
      action: "mine",
      profession: "miner",
      requiredTier: 2,
      materials: ["iron_ore", "copper_ore"],
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validation.ts tests
// ---------------------------------------------------------------------------

describe("validateLoadedContent", () => {
  test("valid content with no cross-references passes", () => {
    const packs = makePacks({
      items: [makeItem("iron_ore")],
      locations: [makeLocation("iron_mine")],
    });
    expect(() => validateLoadedContent(packs)).not.toThrow();
  });

  test("valid content with recipe referencing known items passes", () => {
    const packs = makePacks({
      items: [makeItem("iron_ore"), makeItem("iron_bar")],
      recipes: [makeRecipe("smelt_iron", "iron_ore", "iron_bar")],
    });
    expect(() => validateLoadedContent(packs)).not.toThrow();
  });

  test("duplicate item IDs throw ContentValidationError", () => {
    const item1 = makeItem("iron_ore");
    const item2 = { ...makeItem("iron_ore"), ...makeSrc("other.json", "$.items[1]") } as SourcedItemDef;
    const packs = makePacks({ items: [item1, item2] });
    expect(() => validateLoadedContent(packs)).toThrow(ContentValidationError);
  });

  test("duplicate item IDs error includes the id in message details", () => {
    const item1 = makeItem("iron_ore");
    const item2 = { ...makeItem("iron_ore"), ...makeSrc("other.json", "$.items[1]") } as SourcedItemDef;
    const packs = makePacks({ items: [item1, item2] });
    let err: ContentValidationError | null = null;
    try {
      validateLoadedContent(packs);
    } catch (e) {
      err = e as ContentValidationError;
    }
    expect(err).not.toBeNull();
    expect(err?.details.some((d) => d.includes("iron_ore"))).toBe(true);
  });

  test("recipe referencing unknown item ID throws ContentValidationError", () => {
    const packs = makePacks({
      items: [makeItem("iron_ore")],
      recipes: [makeRecipe("smelt_iron", "iron_ore", "nonexistent_bar")],
    });
    expect(() => validateLoadedContent(packs)).toThrow(ContentValidationError);
  });

  test("drop table referencing unknown location ID throws", () => {
    const packs = makePacks({
      items: [makeItem("iron_ore")],
      dropTables: [makeDropTable("dt_iron", "iron_ore", "nonexistent_location")],
    });
    expect(() => validateLoadedContent(packs)).toThrow(ContentValidationError);
  });

  test("drop table referencing known location ID passes", () => {
    const packs = makePacks({
      items: [makeItem("iron_ore")],
      dropTables: [makeDropTable("dt_iron", "iron_ore", "iron_mine")],
      locations: [makeLocation("iron_mine")],
    });
    expect(() => validateLoadedContent(packs)).not.toThrow();
  });

  test("ValidationContext.extraItemIds allows referencing external items", () => {
    const packs = makePacks({
      items: [makeItem("iron_bar")],
      recipes: [makeRecipe("smelt_iron", "external_ore", "iron_bar")],
    });
    const ctx: ValidationContext = {
      extraItemIds: new Set(["external_ore"]),
    };
    expect(() => validateLoadedContent(packs, ctx)).not.toThrow();
  });

  test("ValidationContext.knownCurrencyIds overrides defaults", () => {
    const recipe: SourcedRecipeDef = {
      ...makeRecipe("buy_item", "iron_ore", "iron_bar"),
      currencyInput: { currencyId: "guild_tokens", amount: 10 },
    } as SourcedRecipeDef;
    const packs = makePacks({
      items: [makeItem("iron_ore"), makeItem("iron_bar")],
      recipes: [recipe],
    });

    // Default currencies don't include "guild_tokens" — should fail
    expect(() => validateLoadedContent(packs)).toThrow(ContentValidationError);

    // With overridden currency IDs — should pass
    const ctx: ValidationContext = {
      knownCurrencyIds: new Set(["guild_tokens", "coins", "rep"]),
    };
    expect(() => validateLoadedContent(packs, ctx)).not.toThrow();
  });

  test("location referencing unknown drop table throws", () => {
    const location: SourcedLocationDef = {
      ...makeLocation("iron_mine"),
      dropTableId: "nonexistent_table",
    } as SourcedLocationDef;
    const packs = makePacks({
      locations: [location],
    });
    expect(() => validateLoadedContent(packs)).toThrow(ContentValidationError);
  });
});

// ---------------------------------------------------------------------------
// registry.ts tests
// ---------------------------------------------------------------------------

describe("getContentRegistry", () => {
  beforeEach(() => {
    resetContentRegistryForTests();
  });

  test("returns null before any registry is loaded", () => {
    expect(getContentRegistry()).toBeNull();
  });

  test("resetContentRegistryForTests clears the cached registry", () => {
    resetContentRegistryForTests();
    expect(getContentRegistry()).toBeNull();
  });
});

describe("buildRegistryFromPacks", () => {
  test("getItem returns item by id", () => {
    const packs = makePacks({
      items: [makeItem("iron_ore")],
    });
    const registry = buildRegistryFromPacks(packs);
    const item = registry.getItem("iron_ore");
    expect(item).not.toBeNull();
    expect(item?.id).toBe("iron_ore");
  });

  test("getItem returns null for unknown id", () => {
    const packs = makePacks({ items: [] });
    const registry = buildRegistryFromPacks(packs);
    expect(registry.getItem("nonexistent")).toBeNull();
  });

  test("listItems returns all items", () => {
    const packs = makePacks({
      items: [makeItem("iron_ore"), makeItem("copper_ore")],
    });
    const registry = buildRegistryFromPacks(packs);
    expect(registry.listItems()).toHaveLength(2);
  });

  test("getRecipe returns recipe by id", () => {
    const packs = makePacks({
      items: [makeItem("iron_ore"), makeItem("iron_bar")],
      recipes: [makeRecipe("smelt_iron", "iron_ore", "iron_bar")],
    });
    const registry = buildRegistryFromPacks(packs);
    const recipe = registry.getRecipe("smelt_iron");
    expect(recipe).not.toBeNull();
    expect(recipe?.id).toBe("smelt_iron");
  });

  test("getRecipe returns null for unknown id", () => {
    const packs = makePacks({ items: [], recipes: [] });
    const registry = buildRegistryFromPacks(packs);
    expect(registry.getRecipe("nonexistent")).toBeNull();
  });

  test("listRecipesByType filters correctly", () => {
    const craftingRecipe = makeRecipe("smelt_iron", "iron_ore", "iron_bar");
    const processingRecipe = {
      ...makeRecipe("process_ore", "raw_ore", "ore_dust"),
      type: "processing" as const,
    } as SourcedRecipeDef;
    const packs = makePacks({
      items: [makeItem("iron_ore"), makeItem("iron_bar"), makeItem("raw_ore"), makeItem("ore_dust")],
      recipes: [craftingRecipe, processingRecipe],
    });
    const registry = buildRegistryFromPacks(packs);
    expect(registry.listRecipesByType("crafting")).toHaveLength(1);
    expect(registry.listRecipesByType("processing")).toHaveLength(1);
  });

  test("findProcessingRecipeByInput finds by first input item", () => {
    const processingRecipe = {
      ...makeRecipe("process_ore", "raw_ore", "ore_dust"),
      type: "processing" as const,
    } as SourcedRecipeDef;
    const packs = makePacks({
      items: [makeItem("raw_ore"), makeItem("ore_dust")],
      recipes: [processingRecipe],
    });
    const registry = buildRegistryFromPacks(packs);
    expect(registry.findProcessingRecipeByInput("raw_ore")).not.toBeNull();
    expect(registry.findProcessingRecipeByInput("nonexistent")).toBeNull();
  });

  test("getLocationById returns location by id", () => {
    const packs = makePacks({
      locations: [makeLocation("iron_mine")],
    });
    const registry = buildRegistryFromPacks(packs);
    expect(registry.getLocationById("iron_mine")).not.toBeNull();
    expect(registry.getLocationById("nonexistent")).toBeNull();
  });

  test("getLocations filters by profession", () => {
    const minerLoc = makeLocation("iron_mine");
    const lumberLoc: SourcedLocationDef = {
      ...makeLocation("oak_forest"),
      action: "forest" as const,
      profession: "lumber" as const,
    } as SourcedLocationDef;
    const packs = makePacks({
      locations: [minerLoc, lumberLoc],
    });
    const registry = buildRegistryFromPacks(packs);
    expect(registry.getLocations("miner")).toHaveLength(1);
    expect(registry.getLocations("lumber")).toHaveLength(1);
    expect(registry.getLocations()).toHaveLength(2);
  });

  test("getDrops returns entries for matching action and tier", () => {
    const packs = makePacks({
      items: [makeItem("iron_ore")],
      dropTables: [makeDropTable("dt_mine_t1", "iron_ore")],
    });
    const registry = buildRegistryFromPacks(packs);
    const drops = registry.getDrops("mine", 1);
    expect(drops).toHaveLength(1);
    expect(drops[0]?.itemId).toBe("iron_ore");
  });

  test("getDrops returns empty array for non-matching tier", () => {
    const packs = makePacks({
      items: [makeItem("iron_ore")],
      dropTables: [makeDropTable("dt_mine_t1", "iron_ore")],
    });
    const registry = buildRegistryFromPacks(packs);
    expect(registry.getDrops("mine", 2)).toHaveLength(0);
  });

  test("duplicate processing recipe inputs throw ContentValidationError", () => {
    const recipe1 = {
      ...makeRecipe("process_ore_1", "raw_ore", "ore_dust_1"),
      type: "processing" as const,
    } as SourcedRecipeDef;
    const recipe2 = {
      ...makeRecipe("process_ore_2", "raw_ore", "ore_dust_2"),
      type: "processing" as const,
      ...makeSrc("recipes2.json", "$.recipes[1]"),
    } as SourcedRecipeDef;
    const packs = makePacks({
      items: [makeItem("raw_ore"), makeItem("ore_dust_1"), makeItem("ore_dust_2")],
      recipes: [recipe1, recipe2],
    });
    expect(() => buildRegistryFromPacks(packs)).toThrow(ContentValidationError);
  });

  test("loadedFrom reflects packDir from packs", () => {
    const packs = makePacks({ packDir: "/custom/content/dir" });
    const registry = buildRegistryFromPacks(packs);
    expect(registry.loadedFrom).toBe("/custom/content/dir");
  });
});
