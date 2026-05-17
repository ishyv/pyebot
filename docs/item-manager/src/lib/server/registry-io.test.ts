import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readItems, readRecipeSummaries, writeItems } from "./registry-io";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(MODULE_DIR, "../../../..");
const DEFAULT_PACK_PATH = path.join(REPO_ROOT, "src/content/packs/default.ts");
const tempDirs: string[] = [];

function copyDefaultPack(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tx-content-"));
  tempDirs.push(dir);
  const packPath = path.join(dir, "default.ts");
  fs.copyFileSync(DEFAULT_PACK_PATH, packPath);
  return packPath;
}

function writeTempPack(source: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tx-content-"));
  tempDirs.push(dir);
  const packPath = path.join(dir, "default.ts");
  fs.writeFileSync(packPath, source, "utf-8");
  return packPath;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { force: true, recursive: true });
  }
});

describe("registry content I/O", () => {
  test("reads the TypeScript content pack", () => {
    const packPath = copyDefaultPack();

    const items = readItems(packPath);
    const recipes = readRecipeSummaries(packPath);

    expect(items.length).toBeGreaterThan(0);
    expect(items[0]).toHaveProperty("id");
    expect(recipes.length).toBeGreaterThan(0);
    expect(recipes[0]).toHaveProperty("ingredients");
  });

  test("writes item changes to a temp pack and reads them back", () => {
    const packPath = copyDefaultPack();
    const before = fs.readFileSync(packPath, "utf-8");
    const items = readItems(packPath);
    const nextDescription = "A stone edited by the item-manager I/O test.";

    writeItems(
      items.map((item) => (item.id === "stone" ? { ...item, description: nextDescription } : item)),
      packPath,
    );

    const after = fs.readFileSync(packPath, "utf-8");
    const updatedItems = readItems(packPath);

    expect(updatedItems.find((item) => item.id === "stone")?.description).toBe(nextDescription);
    expect(after).toContain(nextDescription);
    expect(after).toContain("locations:");
    expect(after).toContain("dropTables:");
    expect(after).toContain("recipes:");
    expect(after).not.toBe(before);
  });

  test("rejects duplicate item IDs before writing", () => {
    const packPath = copyDefaultPack();
    const items = readItems(packPath);

    expect(() => writeItems([...items, { ...items[0] }], packPath)).toThrow(
      'Duplicate item id "stone"',
    );
  });

  test("rejects invalid item IDs before writing", () => {
    const packPath = copyDefaultPack();
    const items = readItems(packPath);

    expect(() => writeItems([{ ...items[0], id: "Bad-ID" }, ...items.slice(1)], packPath)).toThrow(
      "Invalid id",
    );
  });

  test("rejects unsupported TypeScript expressions", () => {
    const packPath = writeTempPack(`import { defineContentPack } from "@/content/authoring";

export const DEFAULT_CONTENT_PACK = defineContentPack({
  id: "test",
  items: { ...baseItems },
  locations: {},
  dropTables: {},
  recipes: {},
});
`);

    expect(() => readItems(packPath)).toThrow("spread properties are not supported");
  });
});
