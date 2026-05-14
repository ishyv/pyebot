/**
 * `loadFeatures()` — discovers feature folders by filesystem scan.
 *
 * Convention-as-contract: a feature is a folder under `src/features/` that
 * contains `index.ts` exporting (as default) a `FeatureDescriptor`. The
 * loader also looks for:
 *
 *   <feature>/commands/*.ts   → CommandModule per file, default-loaded
 *   <feature>/handlers.ts     → optional; default export must be a class
 *                                whose prototype carries @On/@Handle
 *                                metadata (read by the framework).
 *
 * Why a filesystem scan and not an explicit registry list?
 *
 *   - Adding a feature = dropping a folder. Forgetting to "also list it"
 *     is impossible because there is no list.
 *   - The folder is the unit of feature ownership — naming, scope,
 *     responsibility. Discovery by folder makes that explicit and visible
 *     when reading the repo.
 *
 * Safety: the loader does NOT silently skip files in `commands/` that
 * don't match the CommandModule shape — it throws at boot. A silently
 * skipped command is worse than a build error: the bot would seem to
 * run fine but the command would just be missing.
 *
 * The loader works for both Bun (no compile step) and `tsc`-built JS by
 * dynamically importing modules via path. Paths are derived from
 * `import.meta.url` so the loader works regardless of where the bot's
 * working directory is.
 */

import { readdir, stat } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { createLogger } from "@/core/logger";
import type {
  CommandModule,
  FeatureDescriptor,
  LoadedFeature,
} from "./types";

const log = createLogger("framework:loader");

/** Root of `src/features/` resolved at runtime relative to this file. */
function featuresRoot(): string {
  const here = fileURLToPath(import.meta.url);
  return join(dirname(here), "..", "features");
}

/** Skip non-feature filesystem entries (e.g. `.DS_Store`). */
function isFeatureName(name: string): boolean {
  return !name.startsWith(".") && !name.startsWith("_");
}

async function dirExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isFile();
  } catch {
    return false;
  }
}

async function importDefault<T>(absPath: string): Promise<T> {
  const url = pathToFileURL(absPath).href;
  const mod = (await import(url)) as { default?: T };
  if (!mod.default) {
    throw new Error(`Module at ${absPath} has no default export.`);
  }
  return mod.default;
}

async function importModule(absPath: string): Promise<Record<string, unknown>> {
  const url = pathToFileURL(absPath).href;
  return (await import(url)) as Record<string, unknown>;
}

function isCommandModule(mod: Record<string, unknown>): boolean {
  return (
    typeof mod.data === "object" &&
    mod.data !== null &&
    typeof (mod.data as { name?: unknown }).name === "string" &&
    typeof (mod.data as { toJSON?: unknown }).toJSON === "function" &&
    typeof mod.execute === "function"
  );
}

async function loadCommands(featureDir: string): Promise<CommandModule[]> {
  const commandsDir = join(featureDir, "commands");
  if (!(await dirExists(commandsDir))) return [];
  const entries = await readdir(commandsDir);
  const result: CommandModule[] = [];
  for (const entry of entries) {
    if (entry.endsWith(".test.ts") || entry.endsWith(".test.js")) continue;
    if (!(entry.endsWith(".ts") || entry.endsWith(".js"))) continue;
    const abs = join(commandsDir, entry);
    const mod = await importModule(abs);
    if (!isCommandModule(mod)) {
      throw new Error(
        `Command file ${abs} is missing required exports (data, execute). ` +
        `Every file in commands/ must be a CommandModule. Delete or move utility files.`,
      );
    }
    result.push(mod as unknown as CommandModule);
  }
  return result;
}

async function loadHandlers(featureDir: string): Promise<object | null> {
  const handlersFile = join(featureDir, "handlers.ts");
  const handlersFileJs = join(featureDir, "handlers.js");
  const path = (await fileExists(handlersFile))
    ? handlersFile
    : (await fileExists(handlersFileJs))
      ? handlersFileJs
      : null;
  if (!path) return null;
  const HandlerClass = await importDefault<new () => object>(path);
  return new HandlerClass();
}

/**
 * Discover every feature folder and assemble a `LoadedFeature` per folder.
 */
export async function loadFeatures(): Promise<LoadedFeature[]> {
  const root = featuresRoot();
  if (!(await dirExists(root))) {
    log.warn(`Features directory not found: ${root}`);
    return [];
  }
  const entries = await readdir(root);
  const features: LoadedFeature[] = [];
  for (const entry of entries) {
    if (!isFeatureName(entry)) continue;
    const featureDir = join(root, entry);
    if (!(await dirExists(featureDir))) continue;
    const indexPath = join(featureDir, "index.ts");
    const indexPathJs = join(featureDir, "index.js");
    const indexFile = (await fileExists(indexPath))
      ? indexPath
      : (await fileExists(indexPathJs))
        ? indexPathJs
        : null;
    if (!indexFile) {
      log.warn(`Skipping ${entry}: no index.ts.`);
      continue;
    }
    const descriptor = await importDefault<FeatureDescriptor>(indexFile);
    if (descriptor.id !== entry) {
      throw new Error(
        `Feature folder "${entry}" exports descriptor with mismatched id "${descriptor.id}". ` +
        `The folder name and the descriptor id MUST match.`,
      );
    }
    const commands = await loadCommands(featureDir);
    const handlers = await loadHandlers(featureDir);
    features.push({ descriptor, commands, handlers });
    log.info(`Loaded feature: ${descriptor.id} (${commands.length} commands, handlers: ${handlers ? "yes" : "no"})`);
  }
  return features;
}
