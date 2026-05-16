/**
 * Reads and writes the canonical typed RPG content pack.
 *
 * The item manager intentionally edits only the `items` section. Recipes,
 * locations, and drop tables stay in the same source file and are validated
 * before the item write is committed.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  type DropTableDef,
  DropTableDefSchema,
  type ItemDef,
  ItemDefSchema,
  type LocationDef,
  LocationDefSchema,
  type RecipeDef,
  RecipeDefSchema,
} from "../../../../src/content/schemas";
import { ContentValidationError, validateLoadedContent } from "../../../../src/content/validation";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACK_PATH = path.resolve(MODULE_DIR, "../../../../src/content/packs/default.ts");

type ContentMaps = {
  items: Record<string, ItemDef>;
  locations: Record<string, LocationDef>;
  dropTables: Record<string, DropTableDef>;
  recipes: Record<string, RecipeDef>;
};

type Section = keyof ContentMaps;
type Sourced<T> = T & { readonly __source: { readonly file: string; readonly jsonPath: string } };

export type { ItemDef };

function extractObjectBlock(
  source: string,
  section: keyof ContentMaps,
  nextSection?: keyof ContentMaps,
): string {
  const startToken = `  ${section}: `;
  const start = source.indexOf(startToken);
  if (start === -1) throw new Error(`Could not find ${section} in typed content pack`);

  const valueStart = start + startToken.length;
  const endToken = nextSection ? `\n\n  ${nextSection}: ` : "\n});";
  const end = source.indexOf(endToken, valueStart);
  if (end === -1) throw new Error(`Could not find end of ${section} in typed content pack`);

  const raw = source.slice(valueStart, end).trim();
  return raw.endsWith(",") ? raw.slice(0, -1) : raw;
}

function readMaps(): ContentMaps {
  const source = fs.readFileSync(PACK_PATH, "utf-8");
  return {
    items: JSON.parse(extractObjectBlock(source, "items", "locations")),
    locations: JSON.parse(extractObjectBlock(source, "locations", "dropTables")),
    dropTables: JSON.parse(extractObjectBlock(source, "dropTables", "recipes")),
    recipes: JSON.parse(extractObjectBlock(source, "recipes")),
  };
}

function formatZodPath(path: readonly (string | number | symbol)[]): string {
  if (path.length === 0) return "$";
  return `$.${path
    .map((part) => (typeof part === "number" ? `[${part}]` : String(part)))
    .join(".")
    .replace(/\.\[/g, "[")}`;
}

function validateSection<T extends { id: string }>(
  section: Section,
  entries: Record<string, unknown>,
  schema: {
    safeParse: (value: unknown) =>
      | { success: true; data: T }
      | {
          success: false;
          error: { issues: Array<{ path: Array<string | number | symbol>; message: string }> };
        };
  },
): Array<[string, T]> {
  const issues: string[] = [];
  const parsed: Array<[string, T]> = [];

  for (const [key, value] of Object.entries(entries)) {
    const result = schema.safeParse(value);
    if (!result.success) {
      for (const issue of result.error.issues) {
        issues.push(
          `${PACK_PATH} $.${section}.${key}${formatZodPath(issue.path).slice(1)}: ${issue.message}`,
        );
      }
      continue;
    }

    if (key !== result.data.id) {
      issues.push(`${PACK_PATH} $.${section}.${key}: key must match id "${result.data.id}"`);
    }
    parsed.push([key, result.data]);
  }

  if (issues.length > 0) {
    throw new Error(`Content schema validation failed:\n${issues.join("\n")}`);
  }

  return parsed;
}

function sourceFor(section: Section, key: string) {
  return { file: PACK_PATH, jsonPath: `$.${section}.${key}` };
}

function sourceEntries<T extends { id: string }>(
  section: Section,
  entries: Array<[string, T]>,
): Array<Sourced<T>> {
  return entries.map(([key, entry]) => ({
    ...entry,
    __source: sourceFor(section, key),
  }));
}

function validateMaps(maps: ContentMaps): void {
  const items = validateSection("items", maps.items, ItemDefSchema);
  const locations = validateSection("locations", maps.locations, LocationDefSchema);
  const dropTables = validateSection("dropTables", maps.dropTables, DropTableDefSchema);
  const recipes = validateSection("recipes", maps.recipes, RecipeDefSchema);

  try {
    validateLoadedContent({
      packDir: PACK_PATH,
      items: sourceEntries("items", items),
      locations: sourceEntries("locations", locations),
      dropTables: sourceEntries("dropTables", dropTables),
      recipes: sourceEntries("recipes", recipes),
    });
  } catch (error) {
    if (error instanceof ContentValidationError) {
      throw new Error(`${error.message}:\n${error.details.join("\n")}`);
    }
    throw error;
  }
}

function itemMapFromArray(items: ItemDef[]): Record<string, ItemDef> {
  const map: Record<string, ItemDef> = {};
  for (const item of items) {
    if (map[item.id]) throw new Error(`Duplicate item id "${item.id}"`);
    map[item.id] = item;
  }
  return map;
}

function renderPack(maps: ContentMaps): string {
  return `import { defineContentPack } from "@/content/authoring";

/**
 * Canonical built-in RPG content.
 *
 * Add new RPG items, deterministic crafting recipes, locations, and drop tables here.
 * The helpers preserve literal IDs so TypeScript can catch bad references before startup.
 */
export const DEFAULT_CONTENT_PACK = defineContentPack({
  id: "ashenmoor_default",

  items: ${JSON.stringify(maps.items, null, 2)},

  locations: ${JSON.stringify(maps.locations, null, 2)},

  dropTables: ${JSON.stringify(maps.dropTables, null, 2)},

  recipes: ${JSON.stringify(maps.recipes, null, 2)},
});

export type DefaultItemId = keyof typeof DEFAULT_CONTENT_PACK.items;
export type DefaultRecipeId = keyof typeof DEFAULT_CONTENT_PACK.recipes;
export type DefaultLocationId = keyof typeof DEFAULT_CONTENT_PACK.locations;
export type DefaultDropTableId = keyof typeof DEFAULT_CONTENT_PACK.dropTables;
`;
}

export function readItems(): ItemDef[] {
  const maps = readMaps();
  validateMaps(maps);
  return Object.values(maps.items);
}

export function writeItems(items: ItemDef[]): void {
  const maps = readMaps();
  const nextMaps: ContentMaps = {
    ...maps,
    items: itemMapFromArray(items),
  };

  validateMaps(nextMaps);

  fs.writeFileSync(PACK_PATH, renderPack(nextMaps), "utf-8");
}
