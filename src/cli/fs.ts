import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { CliFileSystem } from "./types";

/** Node-backed filesystem boundary used by the executable CLI wrapper. */
export function nodeFileSystem(cwd = process.cwd()): CliFileSystem {
  return {
    cwd,
    exists: async (path) => existsSync(path),
    readFile: (path) => readFile(path, "utf8"),
    writeFile: async (path, content) => {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content, "utf8");
    },
  };
}
