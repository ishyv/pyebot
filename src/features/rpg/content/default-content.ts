/**
 * Canonical source fallback for RPG runtime content.
 *
 * Mongo `rpg_content.active` is still the live editable source when present.
 * This module is only the source-controlled boot fallback and test reset seed.
 * Keep gameplay fallback maps here so runtime reload and authoring pack item
 * seeding cannot drift across separate files.
 */

import { DEFAULT_RPG_ITEMS } from "@/content/packs/default-items";
import type { RpgContentSnapshot } from "./runtime";

export const DEFAULT_RPG_CONTENT: RpgContentSnapshot = {
  items: DEFAULT_RPG_ITEMS,
  materials: {
    stone: { name: "Stone", tier: 1, source: "mine" },
    copper_ore: { name: "Copper Ore", tier: 2, source: "mine" },
    iron_ore: { name: "Iron Ore", tier: 3, source: "mine" },
    silver_ore: { name: "Silver Ore", tier: 4, source: "mine" },
    oak_wood: { name: "Oak Wood", tier: 1, source: "forest" },
    spruce_wood: { name: "Spruce Wood", tier: 2, source: "forest" },
    palm_wood: { name: "Palm Wood", tier: 3, source: "forest" },
    pine_wood: { name: "Pine Wood", tier: 4, source: "forest" },
    stone_block: { name: "Stone Block", tier: 1, source: "processing" },
    copper_ingot: { name: "Copper Ingot", tier: 2, source: "processing" },
    iron_ingot: { name: "Iron Ingot", tier: 3, source: "processing" },
    silver_ingot: { name: "Silver Ingot", tier: 4, source: "processing" },
    oak_plank: { name: "Oak Plank", tier: 1, source: "processing" },
    spruce_plank: { name: "Spruce Plank", tier: 2, source: "processing" },
    palm_plank: { name: "Palm Plank", tier: 3, source: "processing" },
    pine_plank: { name: "Pine Plank", tier: 4, source: "processing" },
  },
  locations: {
    stone_mine: {
      id: "stone_mine",
      name: "Stone Mine",
      action: "mine",
      requiredTier: 1,
      materials: ["stone"],
    },
    copper_mine: {
      id: "copper_mine",
      name: "Copper Mine",
      action: "mine",
      requiredTier: 2,
      materials: ["copper_ore"],
    },
    iron_mine: {
      id: "iron_mine",
      name: "Iron Mine",
      action: "mine",
      requiredTier: 3,
      materials: ["iron_ore"],
    },
    silver_mine: {
      id: "silver_mine",
      name: "Silver Mine",
      action: "mine",
      requiredTier: 4,
      materials: ["silver_ore"],
    },
    oak_forest: {
      id: "oak_forest",
      name: "Oak Forest",
      action: "forest",
      requiredTier: 1,
      materials: ["oak_wood"],
    },
    spruce_forest: {
      id: "spruce_forest",
      name: "Spruce Forest",
      action: "forest",
      requiredTier: 2,
      materials: ["spruce_wood"],
    },
    palm_forest: {
      id: "palm_forest",
      name: "Palm Forest",
      action: "forest",
      requiredTier: 3,
      materials: ["palm_wood"],
    },
    pine_forest: {
      id: "pine_forest",
      name: "Pine Forest",
      action: "forest",
      requiredTier: 4,
      materials: ["pine_wood"],
    },
  },
  tools: {
    starter_pickaxe: {
      name: "Starter Pickaxe",
      kind: "pickaxe",
      tier: 1,
      startingDurability: 50,
    },
    starter_axe: { name: "Starter Axe", kind: "axe", tier: 1, startingDurability: 50 },
    stone_pickaxe: { name: "Stone Pickaxe", kind: "pickaxe", tier: 2, startingDurability: 100 },
    stone_axe: { name: "Stone Axe", kind: "axe", tier: 2, startingDurability: 100 },
    copper_pickaxe: {
      name: "Copper Pickaxe",
      kind: "pickaxe",
      tier: 3,
      startingDurability: 100,
    },
    copper_axe: { name: "Copper Axe", kind: "axe", tier: 3, startingDurability: 100 },
    iron_pickaxe: { name: "Iron Pickaxe", kind: "pickaxe", tier: 4, startingDurability: 100 },
    iron_axe: { name: "Iron Axe", kind: "axe", tier: 4, startingDurability: 100 },
  },
  craftingRecipes: {
    stone_pickaxe: { requires: { stone: 3 } },
    copper_pickaxe: { requires: { copper_ingot: 3 } },
    iron_pickaxe: { requires: { iron_ingot: 3 } },
    stone_axe: { requires: { oak_plank: 3 } },
    copper_axe: { requires: { copper_ingot: 3 } },
    iron_axe: { requires: { iron_ingot: 3 } },
  },
  processingRecipes: {
    stone: { output: "stone_block", materialsPerBatch: 2, outputPerBatch: 1, tier: 1 },
    copper_ore: { output: "copper_ingot", materialsPerBatch: 2, outputPerBatch: 1, tier: 2 },
    iron_ore: { output: "iron_ingot", materialsPerBatch: 2, outputPerBatch: 1, tier: 3 },
    silver_ore: { output: "silver_ingot", materialsPerBatch: 2, outputPerBatch: 1, tier: 4 },
    oak_wood: { output: "oak_plank", materialsPerBatch: 2, outputPerBatch: 1, tier: 1 },
    spruce_wood: { output: "spruce_plank", materialsPerBatch: 2, outputPerBatch: 1, tier: 2 },
    palm_wood: { output: "palm_plank", materialsPerBatch: 2, outputPerBatch: 1, tier: 3 },
    pine_wood: { output: "pine_plank", materialsPerBatch: 2, outputPerBatch: 1, tier: 4 },
  },
};
