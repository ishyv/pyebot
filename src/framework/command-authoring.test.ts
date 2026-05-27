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

/** Tokens that are unambiguous signals of an un-migrated command file. */
const BANNED_PATTERNS: Array<{ token: string; description: string }> = [
  { token: "defineCommand", description: "legacy defineCommand helper" },
  { token: "SlashCommandBuilder", description: "raw SlashCommandBuilder import" },
  {
    token: ".run(({ interaction, ctx }) =>",
    description: "old adapter .run shape — use canonical async (c) => handler",
  },
  {
    token: "async function execute(interaction",
    description: "old execute wrapper — inline handler into .run()",
  },
];

describe("feature command authoring", () => {
  it("uses the framework command DSL instead of legacy command builders", async () => {
    const offenders: string[] = [];
    for (const file of await commandFiles()) {
      const text = await readFile(file, "utf8");
      for (const { token, description } of BANNED_PATTERNS) {
        if (text.includes(token)) {
          offenders.push(`${file.replace(process.cwd(), ".")} — ${description}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
