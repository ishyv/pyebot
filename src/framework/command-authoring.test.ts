import { describe, expect, it } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join, sep } from "node:path";

async function commandFiles(dir = join(process.cwd(), "src", "features")): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await commandFiles(path)));
    } else if (
      path.includes(`${sep}commands${sep}`) &&
      path.endsWith(".ts") &&
      !path.endsWith(".test.ts")
    ) {
      files.push(path);
    }
  }
  return files;
}

describe("feature command authoring", () => {
  it("uses the framework command DSL instead of legacy command builders", async () => {
    const offenders: string[] = [];
    for (const file of await commandFiles()) {
      const text = await readFile(file, "utf8");
      if (text.includes("defineCommand") || text.includes("SlashCommandBuilder")) {
        offenders.push(file.replace(process.cwd(), "."));
      }
    }

    expect(offenders).toEqual([]);
  });
});
