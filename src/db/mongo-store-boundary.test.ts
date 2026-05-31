import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { relative } from "node:path";

const root = process.cwd().replaceAll("\\", "/");

const allowedMongoStoreFiles = new Set([
  "src/db/repositories/appeals.ts",
  "src/db/repositories/counting.ts",
  "src/db/repositories/economy.ts",
  "src/db/repositories/embeds.ts",
  "src/db/repositories/guilds.ts",
  "src/db/repositories/offers.ts",
  "src/db/repositories/rpg-discovery.ts",
  "src/db/repositories/tempBans.ts",
  "src/db/repositories/users.ts",
  "src/db/repositories/embeds.test.ts",
  "src/db/mongo-store-boundary.test.ts",
  "src/db/store.test.ts",
]);

function repoPath(path: string): string {
  return relative(root, path).replaceAll("\\", "/");
}

describe("MongoStore legacy boundary", () => {
  test("keeps MongoStore construction inside approved legacy repository files", () => {
    const output = Bun.spawnSync({
      cmd: ["rg", "-l", "new MongoStore|import \\{ MongoStore \\}", "src"],
      cwd: root,
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(output.exitCode).toBe(0);

    const offenders = output.stdout
      .toString()
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((path) => repoPath(path))
      .filter((path) => !allowedMongoStoreFiles.has(path));

    expect(offenders).toEqual([]);
  });

  test("allowlist entries still contain a real MongoStore boundary", () => {
    for (const path of allowedMongoStoreFiles) {
      const text = readFileSync(`${root}/${path}`, "utf8");
      expect(text).toMatch(/new MongoStore|MongoStore/);
    }
  });
});
