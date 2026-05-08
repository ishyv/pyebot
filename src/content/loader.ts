/**
 * Content Pack Loader.
 *
 * Purpose: Load and validate RPG content packs (items, recipes, drop tables, locations)
 * from JSON/JSON5 files at startup. Provides source metadata for debugging.
 *
 * Context: Called during bootstrap before bot starts; failures are fatal.
 *
 * Dependencies:
 * - Node fs/promises for file I/O
 * - Zod schemas for validation
 * - JSON5 parser (optional, falls back to loose parser)
 *
 * Invariants:
 * - All content files must exist at the expected paths.
 * - Validation failures throw ContentLoadError with detailed path info.
 * - Source metadata (__source) is attached to every loaded entity for traceability.
 *
 * Gotchas:
 * - JSON5 support requires the json5 package; falls back to loose parser on failure.
 * - Trailing commas and comments are stripped for loose parsing (may fail on edge cases).
 * - File basenames are hardcoded in PACK_FILE_BASENAMES.
 *
 * RISK: Changing schema validation rules without updating content files breaks startup.
 * ALT: Consider hot-reload for development; currently requires restart.
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { z } from "zod";
import {
  DropTablePackSchema,
  ItemPackSchema,
  LocationPackSchema,
  RecipePackSchema,
  type DropTableDef,
  type ItemDef,
  type LocationDef,
  type RecipeDef,
} from "@/content/schemas";
import { materializeContentPack } from "@/content/authoring";
import { DEFAULT_CONTENT_PACK } from "@/content/packs/default";

const PACK_FILE_BASENAMES = {
  materials: "rpg.materials",
  craftables: "rpg.craftables",
  recipes: "rpg.recipes",
  dropTables: "rpg.drop_tables",
  locations: "rpg.locations",
} as const;

export const DEFAULT_CONTENT_PACKS_DIR = path.resolve(
  process.cwd(),
  "content",
  "packs",
);

type PackKey = keyof typeof PACK_FILE_BASENAMES;

export interface SourceMeta {
  readonly file: string;
  readonly jsonPath: string;
}

export type Sourced<T> = T & { readonly __source: SourceMeta };
export type SourcedItemDef = Sourced<ItemDef>;
export type SourcedRecipeDef = Sourced<RecipeDef>;
export type SourcedDropTableDef = Sourced<DropTableDef>;
export type SourcedLocationDef = Sourced<LocationDef>;

export interface LoadedContentPacks {
  readonly packDir: string;
  readonly items: readonly SourcedItemDef[];
  readonly recipes: readonly SourcedRecipeDef[];
  readonly dropTables: readonly SourcedDropTableDef[];
  readonly locations: readonly SourcedLocationDef[];
}

export class ContentLoadError extends Error {
  constructor(
    message: string,
    public readonly details: readonly string[] = [],
  ) {
    super(message);
    this.name = "ContentLoadError";
  }
}

function formatZodIssues(issues: readonly z.ZodIssue[], file: string): string[] {
  return issues.map((issue) => {
    const jsonPath = issue.path.length
      ? `$.${issue.path
          .map((part) =>
            typeof part === "number" ? `[${part}]` : String(part),
          )
          .join(".")
          .replace(/\.\[/g, "[")}`
      : "$";
    return `${file} ${jsonPath}: ${issue.message}`;
  });
}

function parseJson5Loose(content: string): unknown {
  const withoutBlockComments = content.replace(/\/\*[\s\S]*?\*\//g, "");
  const withoutLineComments = withoutBlockComments.replace(/^\s*\/\/.*$/gm, "");
  const withoutTrailingCommas = withoutLineComments.replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(withoutTrailingCommas);
}

function parseContentFile(rawContent: string, filePath: string): unknown {
  if (filePath.endsWith(".json")) {
    return JSON.parse(rawContent);
  }

  if (filePath.endsWith(".json5")) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const json5 = require("json5") as { parse: (raw: string) => unknown };
      return json5.parse(rawContent);
    } catch (error: unknown) {
      // Only fall back to loose parser when json5 package is missing
      if ((error as NodeJS.ErrnoException).code !== "MODULE_NOT_FOUND") {
        throw error; // Real parse error — rethrow
      }
      return parseJson5Loose(rawContent);
    }
  }

  throw new ContentLoadError(`Unsupported content file extension: ${filePath}`);
}

function resolvePackFilePath(packDir: string, packKey: PackKey): string {
  const baseName = PACK_FILE_BASENAMES[packKey];
  const json5Path = path.join(packDir, `${baseName}.json5`);
  if (existsSync(json5Path)) {
    return json5Path;
  }

  const jsonPath = path.join(packDir, `${baseName}.json`);
  if (existsSync(jsonPath)) {
    return jsonPath;
  }

  throw new ContentLoadError(
    `Missing required content pack: ${baseName}.json or ${baseName}.json5`,
    [path.join(packDir, baseName)],
  );
}

function sourceJoin(basePath: string, index: number): string {
  return `${basePath}[${index}]`;
}

export async function loadDefaultContentPacks(): Promise<LoadedContentPacks> {
  return materializeContentPack(DEFAULT_CONTENT_PACK);
}

export async function loadLegacyContentPacks(
  packDir: string = DEFAULT_CONTENT_PACKS_DIR,
): Promise<LoadedContentPacks> {
  const files = {
    materials: resolvePackFilePath(packDir, "materials"),
    craftables: resolvePackFilePath(packDir, "craftables"),
    recipes: resolvePackFilePath(packDir, "recipes"),
    dropTables: resolvePackFilePath(packDir, "dropTables"),
    locations: resolvePackFilePath(packDir, "locations"),
  } as const;

  async function readAndParse(filePath: string): Promise<unknown> {
    const rawContent = await readFile(filePath, "utf8");
    try {
      return parseContentFile(rawContent, filePath);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new ContentLoadError(`Failed to parse content file ${filePath}`, [
        `${filePath}: ${reason}`,
      ]);
    }
  }

  const [materialsRaw, craftablesRaw, recipesRaw, dropTablesRaw, locationsRaw] = await Promise.all([
    readAndParse(files.materials),
    readAndParse(files.craftables),
    readAndParse(files.recipes),
    readAndParse(files.dropTables),
    readAndParse(files.locations),
  ]);

  const materialsParsed = ItemPackSchema.safeParse(materialsRaw);
  if (!materialsParsed.success) {
    throw new ContentLoadError(
      "Invalid materials content pack",
      formatZodIssues(materialsParsed.error.issues, files.materials),
    );
  }

  const craftablesParsed = ItemPackSchema.safeParse(craftablesRaw);
  if (!craftablesParsed.success) {
    throw new ContentLoadError(
      "Invalid craftables content pack",
      formatZodIssues(craftablesParsed.error.issues, files.craftables),
    );
  }

  const recipesParsed = RecipePackSchema.safeParse(recipesRaw);
  if (!recipesParsed.success) {
    throw new ContentLoadError(
      "Invalid recipes content pack",
      formatZodIssues(recipesParsed.error.issues, files.recipes),
    );
  }

  const dropTablesParsed = DropTablePackSchema.safeParse(dropTablesRaw);
  if (!dropTablesParsed.success) {
    throw new ContentLoadError(
      "Invalid drop tables content pack",
      formatZodIssues(dropTablesParsed.error.issues, files.dropTables),
    );
  }

  const locationsParsed = LocationPackSchema.safeParse(locationsRaw);
  if (!locationsParsed.success) {
    throw new ContentLoadError(
      "Invalid locations content pack",
      formatZodIssues(locationsParsed.error.issues, files.locations),
    );
  }

  const sourcedMaterials = materialsParsed.data.items.map((item, index) => ({
    ...item,
    __source: { file: files.materials, jsonPath: sourceJoin("$.items", index) },
  }));
  const sourcedCraftables = craftablesParsed.data.items.map((item, index) => ({
    ...item,
    __source: { file: files.craftables, jsonPath: sourceJoin("$.items", index) },
  }));
  const sourcedRecipes = recipesParsed.data.recipes.map((recipe, index) => ({
    ...recipe,
    __source: { file: files.recipes, jsonPath: sourceJoin("$.recipes", index) },
  }));
  const sourcedDropTables = dropTablesParsed.data.dropTables.map((dropTable, index) => ({
    ...dropTable,
    __source: {
      file: files.dropTables,
      jsonPath: sourceJoin("$.dropTables", index),
    },
  }));
  const sourcedLocations = locationsParsed.data.locations.map((location, index) => ({
    ...location,
    __source: {
      file: files.locations,
      jsonPath: sourceJoin("$.locations", index),
    },
  }));

  return {
    packDir,
    items: [...sourcedMaterials, ...sourcedCraftables],
    recipes: sourcedRecipes,
    dropTables: sourcedDropTables,
    locations: sourcedLocations,
  };
}

export async function loadContentPacks(
  packDir?: string,
): Promise<LoadedContentPacks> {
  if (!packDir) {
    return loadDefaultContentPacks();
  }

  return loadLegacyContentPacks(packDir);
}
