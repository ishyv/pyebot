import {
  defineContentPack,
  defineDropTables,
  defineItems,
  defineLocations,
  defineRecipes,
} from "@/content/authoring";

const typecheckItems = defineItems({
  stone: {
    id: "stone",
    name: "Stone",
    category: "mineral",
    rarity: "common",
    trait1: "Density",
    trait2: "None",
    sources: ["gather"],
    description: "A stone.",
  },
  sharp_stone: {
    id: "sharp_stone",
    name: "Sharp Stone",
    category: "component",
    rarity: "common",
    trait1: "Sharpness",
    trait2: "Density",
    sources: ["craft"],
    description: "A sharpened stone.",
  },
});

const typecheckLocations = defineLocations<
  keyof typeof typecheckItems & string,
  {
    stone_mine: {
      id: "stone_mine";
      name: "Stone Mine";
      action: "mine";
      profession: "miner";
      requiredTier: 1;
      materials: ["stone"];
    };
  }
>({
  stone_mine: {
    id: "stone_mine",
    name: "Stone Mine",
    action: "mine",
    profession: "miner",
    requiredTier: 1,
    materials: ["stone"],
  },
});

export const validAuthoringTypecheckPack = defineContentPack({
  id: "typecheck_pack",
  items: typecheckItems,
  locations: typecheckLocations,
  dropTables: defineDropTables<
    keyof typeof typecheckItems & string,
    keyof typeof typecheckLocations & string,
    {
      stone_mine_drops: {
        id: "stone_mine_drops";
        action: "mine";
        tier: 1;
        locationId: "stone_mine";
        entries: [{ itemId: "stone"; chance: 1; weight: 1; minQty: 1 }];
      };
    }
  >({
    stone_mine_drops: {
      id: "stone_mine_drops",
      action: "mine",
      tier: 1,
      locationId: "stone_mine",
      entries: [{ itemId: "stone", chance: 1, weight: 1, minQty: 1 }],
    },
  }),
  recipes: defineRecipes<
    keyof typeof typecheckItems & string,
    {
      sharpen_stone: {
        id: "sharpen_stone";
        name: "Sharpen Stone";
        description: "Make a sharp stone.";
        type: "crafting";
        craftingMethod: "transform";
        itemInputs: [{ itemId: "stone"; quantity: 1 }];
        itemOutputs: [{ itemId: "sharp_stone"; quantity: 1 }];
        xpReward: 0;
        enabled: true;
      };
    }
  >({
    sharpen_stone: {
      id: "sharpen_stone",
      name: "Sharpen Stone",
      description: "Make a sharp stone.",
      type: "crafting",
      craftingMethod: "transform",
      itemInputs: [{ itemId: "stone", quantity: 1 }],
      itemOutputs: [{ itemId: "sharp_stone", quantity: 1 }],
      xpReward: 0,
      enabled: true,
    },
  }),
});

export const mismatchedItemKeyShouldFail = defineItems({
  // @ts-expect-error Item object keys must match item.id.
  stone: { id: "sharp_stone" },
});

export const unknownRecipeItemShouldFail = defineRecipes<
  keyof typeof typecheckItems & string,
  // @ts-expect-error Recipe item references must be known item IDs.
  {
    bad_recipe: {
      id: "bad_recipe";
      name: "Bad Recipe";
      description: "References a missing item.";
      type: "crafting";
      itemInputs: [{ itemId: "missing_item"; quantity: 1 }];
      itemOutputs: [{ itemId: "sharp_stone"; quantity: 1 }];
      xpReward: 0;
      enabled: true;
    };
  }
>({
  bad_recipe: {
    id: "bad_recipe",
    name: "Bad Recipe",
    description: "References a missing item.",
    type: "crafting",
    itemInputs: [{ itemId: "missing_item", quantity: 1 }],
    itemOutputs: [{ itemId: "sharp_stone", quantity: 1 }],
    xpReward: 0,
    enabled: true,
  },
});

export const unknownDropLocationShouldFail = defineDropTables<
  keyof typeof typecheckItems & string,
  keyof typeof typecheckLocations & string,
  // @ts-expect-error Drop table location references must be known location IDs.
  {
    bad_drops: {
      id: "bad_drops";
      action: "mine";
      tier: 1;
      locationId: "missing_location";
      entries: [{ itemId: "stone"; chance: 1; weight: 1; minQty: 1 }];
    };
  }
>({
  bad_drops: {
    id: "bad_drops",
    action: "mine",
    tier: 1,
    locationId: "missing_location",
    entries: [{ itemId: "stone", chance: 1, weight: 1, minQty: 1 }],
  },
});
