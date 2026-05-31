/**
 * Live tool catalog.
 *
 * Equipped weapons in user loadouts may contain an itemId outside this map
 * (stale DB rows, future content). Use `parseToolId` at boundaries and
 * `toolTier` / `toolKind` for forgiving lookups that fall back safely.
 *
 * RISK: changing fallback behavior affects old loadouts and any dashboard
 * content that temporarily removes a tool ID. Keep command error rendering
 * separate from progression fallback rules.
 */

import { type RuntimeToolDef, runtimeTools } from "./runtime";

export type ToolKind = "pickaxe" | "axe";

export type ToolDef = RuntimeToolDef;

export const TOOLS = runtimeTools as Record<string, ToolDef>;

/** Runtime tool ID after `parseToolId` succeeds. */
export type ToolId = string;

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
