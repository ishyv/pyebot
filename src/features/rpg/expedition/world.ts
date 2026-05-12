/**
 * Expedition world model.
 *
 * Maps biome + depth to existing typed gathering locations and generates
 * visible resource nodes for each depth level.
 *
 * Depth is a 1:1 alias for location tier — depth 1 = tier 1 locations,
 * depth 4 = tier 4 locations. This lets the expedition UI express "going
 * deeper" without introducing a concept separate from the existing tier model.
 */

import type { GatherAction } from "@/features/rpg/content/actions";
import { LOCATIONS, type LocationId } from "@/features/rpg/content/locations";
import { MATERIALS, type MaterialId } from "@/features/rpg/content/materials";

export type Biome = "mine" | "forest";

/** Depth 1..4 mirrors location requiredTier 1..4. */
export type Depth = 1 | 2 | 3 | 4;

export const MAX_DEPTH: Depth = 4;

/** Static biome → depth → LocationId. Derived from LOCATIONS. */
const BIOME_DEPTH_LOCATION = {
  mine:   { 1: "stone_mine",    2: "copper_mine",   3: "iron_mine",   4: "silver_mine"  },
  forest: { 1: "oak_forest",    2: "spruce_forest",  3: "palm_forest", 4: "pine_forest"  },
} as const satisfies Record<Biome, Record<Depth, LocationId>>;

const BIOME_ACTION: Record<Biome, GatherAction> = {
  mine:   "mine",
  forest: "forest",
};

/** Returns the LocationId for a biome at a given depth. */
export function locationForBiomeDepth(biome: Biome, depth: Depth): LocationId {
  return BIOME_DEPTH_LOCATION[biome][depth];
}

/** Returns the display name of the location at this biome + depth. */
export function locationNameForBiomeDepth(biome: Biome, depth: Depth): string {
  return LOCATIONS[locationForBiomeDepth(biome, depth)].name;
}

/** Returns the GatherAction for a biome. */
export function actionForBiome(biome: Biome): GatherAction {
  return BIOME_ACTION[biome];
}

// ---------------------------------------------------------------------------
// Node generation
// ---------------------------------------------------------------------------

export interface ExpeditionNode {
  /** Index-based string ID, used as the gather button's customId suffix. */
  readonly id: string;
  readonly itemId: MaterialId;
  readonly display: string;
  readonly flavor: string;
}

/** Flavor text pools keyed by MaterialId. Falls back to a generic line. */
const NODE_FLAVOR: Partial<Record<MaterialId, readonly string[]>> = {
  stone:        ["Rough grey stone juts from the wall.", "A plain cluster, solid but workable.", "Common stone, easy to break away."],
  copper_ore:   ["A faint orange glimmer in the rock.", "Copper threads run through the stone face.", "The ore shimmers faintly in the dim light."],
  iron_ore:     ["Dense dark ore packed into the wall.", "Heavy iron veins criss-cross the surface.", "Cold iron, waiting to be claimed."],
  silver_ore:   ["A rare streak of silver catches your lantern light.", "Pure silver, deep in the mountain's heart.", "The most precious ore at this depth."],
  oak_wood:     ["A stout oak, good for planks.", "Thick bark and solid heartwood.", "An old oak, wide and steady."],
  spruce_wood:  ["Tall and straight — ideal for lumber.", "A spruce with dense, tight grain.", "The air smells of pine resin."],
  palm_wood:    ["A tall palm sways in the warm air.", "Fibrous wood, useful for crafting.", "Tropical warmth radiates from the bark."],
  pine_wood:    ["An ancient pine towers overhead.", "Sticky with resin, rich with grain.", "The rarest timber in the forest."],
};

function nodeInfoFor(itemId: MaterialId): { display: string; flavor: string } {
  const display = MATERIALS[itemId].name;
  const flavors = NODE_FLAVOR[itemId];
  const flavor = flavors
    ? flavors[Math.floor(Math.random() * flavors.length)]!
    : "Something of interest catches your eye.";
  return { display, flavor };
}

/**
 * Generate 3–5 random visible resource nodes for (biome, depth).
 * Candidates come from the location's typed materials list.
 */
export function generateNodes(biome: Biome, depth: Depth): ExpeditionNode[] {
  const locationId = locationForBiomeDepth(biome, depth);
  const candidates = LOCATIONS[locationId].materials;

  const count = 3 + Math.floor(Math.random() * 3); // 3–5
  const nodes: ExpeditionNode[] = [];
  for (let i = 0; i < count; i++) {
    const itemId = candidates[Math.floor(Math.random() * candidates.length)]!;
    const { display, flavor } = nodeInfoFor(itemId);
    nodes.push({ id: String(i), itemId, display, flavor });
  }
  return nodes;
}
