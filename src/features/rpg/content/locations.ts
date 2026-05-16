/**
 * Static gathering locations.
 *
 * Source of truth for /expedition gathering locations.
 * `LocationId = keyof typeof LOCATIONS` is the trusted ID type that domain
 * functions like `gatherAtLocation` accept.
 */

import type { GatherAction } from "./actions";
import type { MaterialId } from "./materials";

export interface LocationDef {
  readonly name: string;
  readonly action: GatherAction;
  readonly requiredTier: 1 | 2 | 3 | 4;
  readonly materials: readonly MaterialId[];
}

export const LOCATIONS = {
  stone_mine: { name: "Stone Mine", action: "mine", requiredTier: 1, materials: ["stone"] },
  copper_mine: { name: "Copper Mine", action: "mine", requiredTier: 2, materials: ["copper_ore"] },
  iron_mine: { name: "Iron Mine", action: "mine", requiredTier: 3, materials: ["iron_ore"] },
  silver_mine: { name: "Silver Mine", action: "mine", requiredTier: 4, materials: ["silver_ore"] },
  oak_forest: { name: "Oak Forest", action: "forest", requiredTier: 1, materials: ["oak_wood"] },
  spruce_forest: {
    name: "Spruce Forest",
    action: "forest",
    requiredTier: 2,
    materials: ["spruce_wood"],
  },
  palm_forest: { name: "Palm Forest", action: "forest", requiredTier: 3, materials: ["palm_wood"] },
  pine_forest: { name: "Pine Forest", action: "forest", requiredTier: 4, materials: ["pine_wood"] },
} as const satisfies Record<string, LocationDef>;

export type LocationId = keyof typeof LOCATIONS;

/** Convenience shape for command-side rendering: location with its ID attached. */
export type LocationView = LocationDef & { readonly id: LocationId };

/**
 * Narrow an untrusted Discord string to a known LocationId.
 * Returns null if the string is not a registered location.
 */
export function parseLocationId(value: string | null | undefined): LocationId | null {
  return value && value in LOCATIONS ? (value as LocationId) : null;
}

/**
 * Narrow an untrusted value to a LocationId that belongs to the requested action.
 * Returns null if unknown or if the location's action does not match.
 */
export function parseLocationForAction(
  value: string | null | undefined,
  action: GatherAction,
): LocationId | null {
  const id = parseLocationId(value);
  return id && LOCATIONS[id].action === action ? id : null;
}

/**
 * All locations for a gathering action, sorted by tier.
 * Used by commands to build button/select rows from the same typed source.
 */
export function locationsForAction(action: GatherAction): readonly LocationView[] {
  const entries: LocationView[] = [];
  for (const [id, def] of Object.entries(LOCATIONS) as [LocationId, LocationDef][]) {
    if (def.action === action) {
      entries.push({ id, ...def });
    }
  }
  return entries.sort((a, b) => a.requiredTier - b.requiredTier);
}
