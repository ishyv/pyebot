/**
 * RPG Gathering Service.
 *
 * Purpose: Mine and cutdown operations — tool-based resource gathering with
 * instance durability and content-registry drop tables.
 *
 * Architecture: Plain exported async functions — no classes (except GatherError).
 * Dependencies: rpg repository (profile), users repository (inventory),
 *   content registry (drop tables, locations).
 *
 * Flow:
 *   gather → validate profile → validate location → validate tool
 *         → decrement durability (or break tool)
 *         → roll drops from content registry (or default table)
 *         → add materials to inventory
 *         → return GatheringResult
 *
 * Invariants:
 * - Tool must be in weapon slot as an instanced item { instanceId, itemId, durability }.
 * - Tool kind must match location type (pickaxe → mine, axe → forest).
 * - Tool tier must be >= location's required tier.
 * - Each gather consumes 1 durability; tool is removed at 0 durability.
 * - Inventory items are stored as numeric quantities at `inventory.<itemId>`.
 */

import { OkResult, ErrResult, type Result } from "@/core/result";
import { ensureRpgProfile, patchRpgProfile } from "@/db/repositories/rpg";
import { updateUserPaths, getUser } from "@/db/repositories/users";
import { getContentRegistry } from "@/content/registry";
import type { GatherAction } from "@/content/schemas";

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
// Types
// ---------------------------------------------------------------------------

export interface GatheringResult {
  readonly userId: string;
  readonly locationId: string;
  readonly locationName: string;
  readonly tier: number;
  readonly toolId: string;
  readonly materialsGained: ReadonlyArray<{ id: string; quantity: number }>;
  readonly remainingDurability: number;
  readonly toolBroken: boolean;
}

// ---------------------------------------------------------------------------
// Default locations (fallback when no content registry is loaded)
// ---------------------------------------------------------------------------

interface LocationDef {
  readonly id: string;
  readonly name: string;
  readonly action: GatherAction;
  readonly requiredTier: number;
  readonly materials: readonly string[];
}

const DEFAULT_LOCATIONS: readonly LocationDef[] = [
  { id: "stone_mine",    name: "Stone Mine",    action: "mine",   requiredTier: 1, materials: ["stone"] },
  { id: "copper_mine",   name: "Copper Mine",   action: "mine",   requiredTier: 2, materials: ["copper_ore"] },
  { id: "iron_mine",     name: "Iron Mine",     action: "mine",   requiredTier: 3, materials: ["iron_ore"] },
  { id: "silver_mine",   name: "Silver Mine",   action: "mine",   requiredTier: 4, materials: ["silver_ore"] },
  { id: "oak_forest",    name: "Oak Forest",    action: "forest", requiredTier: 1, materials: ["oak_wood"] },
  { id: "spruce_forest", name: "Spruce Forest", action: "forest", requiredTier: 2, materials: ["spruce_wood"] },
  { id: "palm_forest",   name: "Palm Forest",   action: "forest", requiredTier: 3, materials: ["palm_wood"] },
  { id: "pine_forest",   name: "Pine Forest",   action: "forest", requiredTier: 4, materials: ["pine_wood"] },
];

function getLocation(locationId: string): LocationDef | null {
  const registry = getContentRegistry();
  if (registry) {
    const loc = registry.getLocationById(locationId);
    if (loc) {
      return {
        id: loc.id,
        name: loc.name,
        action: loc.action,
        requiredTier: loc.requiredTier,
        materials: loc.materials ?? [],
      };
    }
  }
  return DEFAULT_LOCATIONS.find((l) => l.id === locationId) ?? null;
}

// ---------------------------------------------------------------------------
// Drop resolution
// ---------------------------------------------------------------------------

function pickWeighted(entries: ReadonlyArray<{ weight: number; itemId: string; minQty: number; maxQty: number }>): { itemId: string; minQty: number; maxQty: number } {
  const total = entries.reduce((acc, e) => acc + e.weight, 0);
  let roll = Math.random() * total;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) return entry;
  }
  return entries[entries.length - 1]!;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rollDrops(
  action: GatherAction,
  tier: number,
  locationId: string,
  fallbackMaterials: readonly string[],
): Array<{ id: string; quantity: number }> {
  const registry = getContentRegistry();
  if (registry) {
    const drops = registry.getDrops(action, tier, { locationId });
    if (drops.length > 0) {
      // Filter by chance roll, then pick from pool
      const eligible = drops.filter((d) => Math.random() < d.chance);
      const pool = eligible.length > 0 ? eligible : drops;
      const picked = pickWeighted(pool);
      return [{ id: picked.itemId, quantity: randomInt(picked.minQty, picked.maxQty) }];
    }
  }

  // Fallback: pick a random material from location, yield 2-5
  const materialId = fallbackMaterials[Math.floor(Math.random() * fallbackMaterials.length)]
    ?? (action === "mine" ? "stone" : "oak_wood");
  return [{ id: materialId, quantity: randomInt(2, 5) }];
}

// ---------------------------------------------------------------------------
// gather (internal)
// ---------------------------------------------------------------------------

async function gather(
  userId: string,
  locationId: string,
  expectedAction: GatherAction,
): Promise<Result<GatheringResult, GatherError>> {
  // Validate profile
  const profileRes = await ensureRpgProfile(userId);
  if (profileRes.isErr()) {
    return ErrResult(new GatherError("PROFILE_NOT_FOUND", "RPG profile not found"));
  }
  const profile = profileRes.unwrap();

  // Validate location
  const location = getLocation(locationId);
  if (!location) {
    return ErrResult(new GatherError("LOCATION_NOT_FOUND", `Location "${locationId}" not found`));
  }
  if (location.action !== expectedAction) {
    const actionName = expectedAction === "mine" ? "mining" : "woodcutting";
    return ErrResult(new GatherError("LOCATION_NOT_FOUND", `This location is not suitable for ${actionName}`));
  }

  // Validate equipped tool
  const equipped = profile.loadout.weapon;
  if (!equipped) {
    const toolName = expectedAction === "mine" ? "pickaxe" : "axe";
    return ErrResult(new GatherError("NO_TOOL_EQUIPPED", `Equip a ${toolName} first`));
  }

  if (typeof equipped === "string") {
    return ErrResult(new GatherError("NO_TOOL_EQUIPPED", "Please unequip and re-equip your tool to use it"));
  }

  // Validate tool kind (use content registry if available)
  const registry = getContentRegistry();
  const itemDef = registry?.getItem(equipped.itemId);
  const toolKind = itemDef?.tool?.toolKind;
  const toolTier = itemDef?.tool?.tier ?? 1;

  if (toolKind) {
    const expectedKind = expectedAction === "mine" ? "pickaxe" : "axe";
    if (toolKind !== expectedKind) {
      return ErrResult(new GatherError("WRONG_TOOL_TYPE", `Equip a ${expectedKind} to ${expectedAction === "mine" ? "mine" : "cut down trees"}`));
    }
  } else {
    // Fallback: check item ID string
    const id = equipped.itemId.toLowerCase();
    const isPickaxe = id.includes("pickaxe");
    const isAxe = id.includes("axe") && !id.includes("pickaxe");
    if (expectedAction === "mine" && !isPickaxe) {
      return ErrResult(new GatherError("WRONG_TOOL_TYPE", "Equip a pickaxe to mine"));
    }
    if (expectedAction === "forest" && !isAxe) {
      return ErrResult(new GatherError("WRONG_TOOL_TYPE", "Equip an axe to cut down trees"));
    }
  }

  // Validate tier requirement
  if (toolTier < location.requiredTier) {
    return ErrResult(new GatherError(
      "INSUFFICIENT_TOOL_TIER",
      `Your tool (tier ${toolTier}) is too weak for this location (requires tier ${location.requiredTier})`,
    ));
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

  // Roll drops
  const materialsGained = rollDrops(location.action, location.requiredTier, location.id, location.materials);

  // Add materials to inventory
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
    locationId: location.id,
    locationName: location.name,
    tier: location.requiredTier,
    toolId: equipped.itemId,
    materialsGained,
    remainingDurability: toolBroken ? 0 : newDurability,
    toolBroken,
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Mine at a location (requires equipped pickaxe in weapon slot). */
export async function mine(
  userId: string,
  locationId: string,
): Promise<Result<GatheringResult, GatherError>> {
  return gather(userId, locationId, "mine");
}

/** Cut down trees at a location (requires equipped axe in weapon slot). */
export async function cutdown(
  userId: string,
  locationId: string,
): Promise<Result<GatheringResult, GatherError>> {
  return gather(userId, locationId, "forest");
}

/** List all available locations of the given type (or all if no type given). */
export function listLocations(type?: GatherAction): readonly LocationDef[] {
  const registry = getContentRegistry();
  if (registry) {
    const locs = registry.getLocations();
    const mapped: LocationDef[] = locs.map((l) => ({
      id: l.id,
      name: l.name,
      action: l.action,
      requiredTier: l.requiredTier,
      materials: l.materials ?? [],
    }));
    return type ? mapped.filter((l) => l.action === type) : mapped;
  }
  return type ? DEFAULT_LOCATIONS.filter((l) => l.action === type) : DEFAULT_LOCATIONS;
}
