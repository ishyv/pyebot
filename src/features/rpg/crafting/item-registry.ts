/**
 * Legacy RPG item registry shim.
 *
 * New content belongs in src/content/packs/default.ts via the typed content
 * authoring helpers. This module remains so older RPG crafting imports keep
 * working during the migration.
 */

import { DEFAULT_CONTENT_PACK } from "@/content/packs/default";
import type {
  ItemCategory,
  ItemDef,
  ItemRarity,
  ItemSource,
} from "@/content/schemas";

export type { ItemCategory, ItemDef, ItemRarity, ItemSource };

export const ITEM_REGISTRY: Record<string, ItemDef> = DEFAULT_CONTENT_PACK.items;

/** Get an item definition by ID, or null if not found. */
export function getItemDef(id: string): ItemDef | null {
  return ITEM_REGISTRY[id] ?? null;
}

/** List all items in a given category. */
export function getItemsByCategory(category: ItemCategory): ItemDef[] {
  return Object.values(ITEM_REGISTRY).filter((item) => item.category === category);
}

/** List all items at a given rarity. */
export function getItemsByRarity(rarity: ItemRarity): ItemDef[] {
  return Object.values(ITEM_REGISTRY).filter((item) => item.rarity === rarity);
}

/** Total count of registered items. */
export function getItemCount(): number {
  return Object.keys(ITEM_REGISTRY).length;
}
