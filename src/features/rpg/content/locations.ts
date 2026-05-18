/**
 * Live gathering locations.
 *
 * The dashboard can replace the runtime map after validation. Command code
 * narrows raw Discord strings with the helpers below before entering domain
 * logic.
 */

import type { GatherAction } from "./actions";
import type { MaterialId } from "./materials";
import { type RuntimeLocationDef, runtimeLocations } from "./runtime";

export interface LocationDef extends RuntimeLocationDef {
  readonly id: string;
  readonly name: string;
  readonly action: GatherAction;
  readonly requiredTier: 1 | 2 | 3 | 4;
  readonly materials: readonly MaterialId[];
}

export const LOCATIONS = runtimeLocations as Record<string, LocationDef>;

export type LocationId = string;

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
  for (const [id, def] of Object.entries(LOCATIONS)) {
    if (def.action === action) {
      entries.push({ ...def, id });
    }
  }
  return entries.sort((a, b) => a.requiredTier - b.requiredTier);
}
