/**
 * RPG Gathering Service.
 *
 * `gatherAtLocation` performs one round of mining/cutting at a validated
 * location: durability tick, drop roll, inventory update. The handler that
 * routes button clicks (`handlers/gather.ts`) narrows the raw Discord custom
 * ID to typed `GatherAction` + `LocationId` before calling here — domain code
 * never receives an arbitrary string.
 *
 * Invariants:
 * - Equipped tool kind must match the action (pickaxe→mine, axe→forest).
 * - Equipped tool tier must be ≥ the location's required tier.
 * - One durability point consumed per call; tool removed at 0.
 * - Inventory items are stored as numeric quantities at `inventory.<MaterialId>`.
 */

import { OkResult, ErrResult, type Result } from "@/core/result";
import { ensureRpgProfile, patchRpgProfile } from "@/db/repositories/rpg";
import { updateUserPaths, getUser } from "@/db/repositories/users";
import type { GatherAction } from "@/features/rpg/content/actions";
import {
  LOCATIONS,
  type LocationId,
} from "@/features/rpg/content/locations";
import {
  TOOL_TIER_FALLBACK,
  requiredToolKindFor,
  toolKind,
  toolTier,
} from "@/features/rpg/content/tools";
import type { MaterialId } from "@/features/rpg/content/materials";

export { TOOL_TIER_FALLBACK };

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class GatherError extends Error {
  constructor(
    public readonly code:
      | "PROFILE_NOT_FOUND"
      | "LOCATION_NOT_FOUND"
      | "NO_TOOL_EQUIPPED"
      | "WRONG_TOOL_TYPE"
      | "INSUFFICIENT_TOOL_TIER"
      | "UPDATE_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "GatherError";
  }
}

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface GatheringResult {
  readonly userId: string;
  readonly locationId: LocationId;
  readonly locationName: string;
  readonly tier: number;
  readonly toolId: string;
  readonly materialsGained: ReadonlyArray<{ id: MaterialId; quantity: number }>;
  readonly remainingDurability: number;
  readonly toolBroken: boolean;
}

// ---------------------------------------------------------------------------
// Drop rolling
// ---------------------------------------------------------------------------

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Picks one material from the location's drop pool and rolls a 2–5 quantity.
 * Pure RNG; no weighting yet — the old weighted/chance-based drop tables only
 * ever ran with the (never-installed) content registry, so the single-material
 * roll is the actual behavior users see today.
 */
function rollDrops(
  materials: readonly MaterialId[],
): Array<{ id: MaterialId; quantity: number }> {
  const id = materials[Math.floor(Math.random() * materials.length)];
  if (!id) return [];
  return [{ id, quantity: randomInt(2, 5) }];
}

// ---------------------------------------------------------------------------
// gatherAtLocation
// ---------------------------------------------------------------------------

/**
 * Performs one gathering action at a validated location.
 * Callers must narrow Discord input to `GatherAction` + `LocationId` first.
 */
export async function gatherAtLocation(
  userId: string,
  action: GatherAction,
  locationId: LocationId,
): Promise<Result<GatheringResult, GatherError>> {
  const profileRes = await ensureRpgProfile(userId);
  if (profileRes.isErr()) {
    return ErrResult(new GatherError("PROFILE_NOT_FOUND", "RPG profile not found"));
  }
  const profile = profileRes.unwrap();

  const location = LOCATIONS[locationId];
  if (location.action !== action) {
    const actionName = action === "mine" ? "mining" : "woodcutting";
    return ErrResult(
      new GatherError("LOCATION_NOT_FOUND", `This location is not suitable for ${actionName}`),
    );
  }

  // Equipped tool validation
  const equipped = profile.loadout.weapon;
  if (!equipped) {
    const toolName = requiredToolKindFor(action);
    return ErrResult(new GatherError("NO_TOOL_EQUIPPED", `Equip a ${toolName} first`));
  }
  if (typeof equipped === "string") {
    return ErrResult(
      new GatherError("NO_TOOL_EQUIPPED", "Please unequip and re-equip your tool to use it"),
    );
  }

  const expectedKind = requiredToolKindFor(action);
  const kind = toolKind(equipped.itemId);
  if (kind !== expectedKind) {
    const verb = action === "mine" ? "mine" : "cut down trees";
    return ErrResult(new GatherError("WRONG_TOOL_TYPE", `Equip a ${expectedKind} to ${verb}`));
  }

  const tier = toolTier(equipped.itemId);
  if (tier < location.requiredTier) {
    return ErrResult(
      new GatherError(
        "INSUFFICIENT_TOOL_TIER",
        `Your tool (tier ${tier}) is too weak for this location (requires tier ${location.requiredTier})`,
      ),
    );
  }

  // Decrement durability
  const newDurability = equipped.durability - 1;
  const toolBroken = newDurability <= 0;

  const newLoadout = {
    ...profile.loadout,
    weapon: toolBroken
      ? null
      : { instanceId: equipped.instanceId, itemId: equipped.itemId, durability: newDurability },
  };

  const patchRes = await patchRpgProfile(userId, { loadout: newLoadout });
  if (patchRes.isErr()) {
    return ErrResult(new GatherError("UPDATE_FAILED", "Failed to save tool durability"));
  }

  // Roll drops, add to inventory
  const materialsGained = rollDrops(location.materials);

  const userRes = await getUser(userId);
  const currentInventory = (userRes.isOk() ? userRes.unwrap()?.inventory : undefined) ?? {};
  const paths: Record<string, number> = {};
  for (const mat of materialsGained) {
    const current = (currentInventory[mat.id] as number | undefined) ?? 0;
    paths[`inventory.${mat.id}`] = current + mat.quantity;
  }

  const invRes = await updateUserPaths(userId, paths);
  if (invRes.isErr()) {
    return ErrResult(new GatherError("UPDATE_FAILED", "Failed to add materials to inventory"));
  }

  return OkResult({
    userId,
    locationId,
    locationName: location.name,
    tier: location.requiredTier,
    toolId: equipped.itemId,
    materialsGained,
    remainingDurability: toolBroken ? 0 : newDurability,
    toolBroken,
  });
}

// ---------------------------------------------------------------------------
// getEquippedToolTier — async wrapper used by command UX
// ---------------------------------------------------------------------------

/**
 * Returns the tier of the user's currently equipped weapon.
 * Falls back to TOOL_TIER_FALLBACK when no tool is equipped, the item is
 * unknown, or the user profile cannot be fetched.
 */
export async function getEquippedToolTier(userId: string): Promise<number> {
  const userRes = await getUser(userId);
  if (userRes.isErr()) return TOOL_TIER_FALLBACK;

  const user = userRes.unwrap();
  const weapon = user?.rpgProfile?.loadout?.weapon;
  if (!weapon) return TOOL_TIER_FALLBACK;

  const itemId = typeof weapon === "string" ? weapon : weapon.itemId;
  return toolTier(itemId);
}
