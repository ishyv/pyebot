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
import ts from "typescript";
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

export interface RecipeSummary {
  readonly id: string;
  readonly method: string;
  readonly ingredients: readonly string[];
  readonly output: {
    readonly id: string;
    readonly qty: number;
  };
}

export type { ItemDef };

interface ParsedPack {
  readonly source: string;
  readonly sourceFile: ts.SourceFile;
  readonly packObject: ts.ObjectLiteralExpression;
}

function parsePack(packPath: string): ParsedPack {
  const source = fs.readFileSync(packPath, "utf-8");
  const sourceFile = ts.createSourceFile(packPath, source, ts.ScriptTarget.Latest, true);
  let packObject: ts.ObjectLiteralExpression | undefined;

  function visit(node: ts.Node): void {
    if (
      !packObject &&
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "defineContentPack" &&
      ts.isObjectLiteralExpression(node.arguments[0])
    ) {
      packObject = node.arguments[0];
      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  if (!packObject) {
    throw new Error(`Could not find defineContentPack({ ... }) in ${packPath}`);
  }

  return { source, sourceFile, packObject };
}

function readPropertyName(name: ts.PropertyName, pathLabel: string): string {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  throw new Error(`${pathLabel}: computed property names are not supported`);
}

function readObjectProperty(
  object: ts.ObjectLiteralExpression,
  propertyName: string,
  pathLabel: string,
): ts.Expression {
  for (const property of object.properties) {
    if (ts.isSpreadAssignment(property)) {
      throw new Error(`${pathLabel}: spread properties are not supported`);
    }

    if (!ts.isPropertyAssignment(property)) {
      throw new Error(`${pathLabel}: shorthand and accessor properties are not supported`);
    }

    if (readPropertyName(property.name, pathLabel) === propertyName) {
      return property.initializer;
    }
  }

  throw new Error(`${pathLabel}: missing ${propertyName} section`);
}

function readLiteral(node: ts.Expression, pathLabel: string): unknown {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);

  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;

  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(node.operand)
  ) {
    return -Number(node.operand.text);
  }

  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.map((element, index) => {
      if (ts.isSpreadElement(element)) {
        throw new Error(`${pathLabel}[${index}]: spread elements are not supported`);
      }
      return readLiteral(element, `${pathLabel}[${index}]`);
    });
  }

  if (ts.isObjectLiteralExpression(node)) {
    const value: Record<string, unknown> = {};
    for (const property of node.properties) {
      if (ts.isSpreadAssignment(property)) {
        throw new Error(`${pathLabel}: spread properties are not supported`);
      }
      if (!ts.isPropertyAssignment(property)) {
        throw new Error(`${pathLabel}: shorthand and accessor properties are not supported`);
      }

      const key = readPropertyName(property.name, pathLabel);
      value[key] = readLiteral(property.initializer, `${pathLabel}.${key}`);
    }
    return value;
  }

  throw new Error(`${pathLabel}: unsupported non-literal expression`);
}

function readObjectSection<T>(
  packObject: ts.ObjectLiteralExpression,
  section: Section,
): Record<string, T> {
  const node = readObjectProperty(packObject, section, "$");
  if (!ts.isObjectLiteralExpression(node)) {
    throw new Error(`$.${section}: expected object literal`);
  }
  return readLiteral(node, `$.${section}`) as Record<string, T>;
}

function readMaps(packPath = PACK_PATH): ContentMaps {
  const { packObject } = parsePack(packPath);
  return {
    items: readObjectSection<ItemDef>(packObject, "items"),
    locations: readObjectSection<LocationDef>(packObject, "locations"),
    dropTables: readObjectSection<DropTableDef>(packObject, "dropTables"),
    recipes: readObjectSection<RecipeDef>(packObject, "recipes"),
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
  packPath: string,
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
          `${packPath} $.${section}.${key}${formatZodPath(issue.path).slice(1)}: ${issue.message}`,
        );
      }
      continue;
    }

    if (key !== result.data.id) {
      issues.push(`${packPath} $.${section}.${key}: key must match id "${result.data.id}"`);
    }
    parsed.push([key, result.data]);
  }

  if (issues.length > 0) {
    throw new Error(`Content schema validation failed:\n${issues.join("\n")}`);
  }

  return parsed;
}

function sourceFor(packPath: string, section: Section, key: string) {
  return { file: packPath, jsonPath: `$.${section}.${key}` };
}

function sourceEntries<T extends { id: string }>(
  packPath: string,
  section: Section,
  entries: Array<[string, T]>,
): Array<Sourced<T>> {
  return entries.map(([key, entry]) => ({
    ...entry,
    __source: sourceFor(packPath, section, key),
  }));
}

function validateMaps(maps: ContentMaps, packPath = PACK_PATH): void {
  const items = validateSection(packPath, "items", maps.items, ItemDefSchema);
  const locations = validateSection(packPath, "locations", maps.locations, LocationDefSchema);
  const dropTables = validateSection(packPath, "dropTables", maps.dropTables, DropTableDefSchema);
  const recipes = validateSection(packPath, "recipes", maps.recipes, RecipeDefSchema);

  try {
    validateLoadedContent({
      packDir: packPath,
      items: sourceEntries(packPath, "items", items),
      locations: sourceEntries(packPath, "locations", locations),
      dropTables: sourceEntries(packPath, "dropTables", dropTables),
      recipes: sourceEntries(packPath, "recipes", recipes),
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

function renderPropertyKey(key: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
}

function renderLiteral(value: unknown, indent = 2): string {
  if (value === null || typeof value === "string" || typeof value === "number") {
    return JSON.stringify(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return `[${value.map((entry) => renderLiteral(entry, indent)).join(", ")}]`;
  }

  if (typeof value === "object" && value) {
    const entries = Object.entries(value);
    if (entries.length === 0) return "{}";

    const childIndent = " ".repeat(indent + 2);
    const currentIndent = " ".repeat(indent);
    const lines = entries.map(
      ([key, entry]) =>
        `${childIndent}${renderPropertyKey(key)}: ${renderLiteral(entry, indent + 2)},`,
    );
    return `{\n${lines.join("\n")}\n${currentIndent}}`;
  }

  throw new Error(`Cannot render unsupported value type "${typeof value}"`);
}

function replaceItemsInitializer(packPath: string, items: Record<string, ItemDef>): void {
  const parsed = parsePack(packPath);
  const itemsNode = readObjectProperty(parsed.packObject, "items", "$");
  const start = itemsNode.getStart(parsed.sourceFile);
  const end = itemsNode.getEnd();
  const nextSource = `${parsed.source.slice(0, start)}${renderLiteral(items, 2)}${parsed.source.slice(end)}`;
  const tempPath = `${packPath}.tmp`;

  fs.writeFileSync(tempPath, nextSource, "utf-8");
  fs.renameSync(tempPath, packPath);
}

function recipeSummary(recipe: RecipeDef): RecipeSummary {
  return {
    id: recipe.id,
    method: recipe.craftingMethod ?? recipe.type ?? "crafting",
    ingredients: recipe.itemInputs.map((input) => input.itemId),
    output: {
      id: recipe.itemOutputs[0]?.itemId ?? "",
      qty: recipe.itemOutputs[0]?.quantity ?? 1,
    },
  };
}

export function readItems(packPath = PACK_PATH): ItemDef[] {
  const maps = readMaps(packPath);
  validateMaps(maps, packPath);
  return Object.values(maps.items);
}

export function writeItems(items: ItemDef[], packPath = PACK_PATH): void {
  const maps = readMaps(packPath);
  const nextMaps: ContentMaps = {
    ...maps,
    items: itemMapFromArray(items),
  };

  validateMaps(nextMaps, packPath);
  replaceItemsInitializer(packPath, nextMaps.items);
}

export function readRecipeSummaries(packPath = PACK_PATH): RecipeSummary[] {
  const maps = readMaps(packPath);
  validateMaps(maps, packPath);
  return Object.values(maps.recipes).map(recipeSummary);
}
