import { defineContentPack } from "@/content/authoring";
import { DEFAULT_RPG_ITEMS } from "./default-items";

/**
 * Built-in RPG content seed.
 *
 * The live bot can load dashboard-authored content from Mongo at runtime. This
 * pack remains the typed source fallback and authoring seed for new installs.
 */
export const DEFAULT_CONTENT_PACK = defineContentPack({
  id: "ashenmoor_default",

  items: DEFAULT_RPG_ITEMS,

  locations: {},
  dropTables: {},
  recipes: {},
});
