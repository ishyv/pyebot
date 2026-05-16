/**
 * Static tool catalog.
 *
 * Replaces the old triple of (registry items + TOOL_TIER_MAP + substring
 * "pickaxe"/"axe" matching). Both gathering tier-gating and tool-kind
 * validation read from this single source.
 *
 * Equipped weapons in user loadouts may contain an itemId outside this set
 * (stale DB rows, future content). Use `parseToolId` at boundaries and
 * `toolTier` / `toolKind` for forgiving lookups that fall back safely.
 */

export type ToolKind = "pickaxe" | "axe";

export interface ToolDef {
  readonly name: string;
  readonly kind: ToolKind;
  readonly tier: 1 | 2 | 3 | 4;
  readonly startingDurability: number;
}

export const TOOLS = {
  starter_pickaxe: { name: "Starter Pickaxe", kind: "pickaxe", tier: 1, startingDurability: 50 },
  starter_axe: { name: "Starter Axe", kind: "axe", tier: 1, startingDurability: 50 },
  stone_pickaxe: { name: "Stone Pickaxe", kind: "pickaxe", tier: 2, startingDurability: 100 },
  stone_axe: { name: "Stone Axe", kind: "axe", tier: 2, startingDurability: 100 },
  copper_pickaxe: { name: "Copper Pickaxe", kind: "pickaxe", tier: 3, startingDurability: 100 },
  copper_axe: { name: "Copper Axe", kind: "axe", tier: 3, startingDurability: 100 },
  iron_pickaxe: { name: "Iron Pickaxe", kind: "pickaxe", tier: 4, startingDurability: 100 },
  iron_axe: { name: "Iron Axe", kind: "axe", tier: 4, startingDurability: 100 },
} as const satisfies Record<string, ToolDef>;

export type ToolId = keyof typeof TOOLS;

/**
 * Tier returned when the equipped item is not a known tool.
 * Keeps backwards compatibility with users who have legacy item IDs in their loadout.
 */
export const TOOL_TIER_FALLBACK = 1 as const;

/** Untrusted-string boundary helper. */
export function parseToolId(value: string | null | undefined): ToolId | null {
  return value && value in TOOLS ? (value as ToolId) : null;
}

/**
 * Lookup-with-fallback for arbitrary equipped item strings.
 * Unknown items report `TOOL_TIER_FALLBACK`, matching the old behavior where
 * no-registry installs treated everything as tier 1.
 */
export function toolTier(itemId: string | null | undefined): number {
  const id = parseToolId(itemId);
  return id ? TOOLS[id].tier : TOOL_TIER_FALLBACK;
}

/** Returns null for unknown items so callers can render a clear "not a tool" error. */
export function toolKind(itemId: string | null | undefined): ToolKind | null {
  const id = parseToolId(itemId);
  return id ? TOOLS[id].kind : null;
}

/** Required tool kind for a gathering action. */
export function requiredToolKindFor(action: "mine" | "forest"): ToolKind {
  return action === "mine" ? "pickaxe" : "axe";
}
