/**
 * Event Module Auto-Loader.
 *
 * Purpose: Automatically require all modules in a directory for side-effect registration.
 * Used by handlers/ and listeners/ to auto-register event handlers at startup.
 *
 * Context: Called at module load time; failures are logged but don't stop startup.
 *
 * Dependencies: Node fs module.
 *
 * Invariants:
 * - Skips directories, index files, and declaration files.
 * - Only loads .ts and .js files.
 * - Errors are logged per-file; other files continue loading.
 *
 * Gotchas:
 * - Side effects happen at require time; order depends on filesystem readdir.
 * - Errors in one file don't prevent others from loading.
 *
 * RISK: Circular dependencies between event modules cause hard-to-debug load errors.
 * RISK: Filesystem order is non-deterministic; don't rely on load order.
 */
import { readdirSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";

/**
 * Auto-import all modules in a directory via side-effect `require`.
 * Skips directories, `index.*`, and `.d.ts` files.
 *
 * @param directory Absolute path to the directory to scan.
 * @param label Label used in error logs (e.g. "events", "listeners").
 *
 * Side effects: Requires each file, triggering any module-level side effects.
 * Errors: Logged per-file; doesn't stop processing other files.
 */
export function autoRequireDirectory(directory: string, label: string): void {
  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) continue;

    const extension = extname(entry);
    if (!extension || (extension !== ".ts" && extension !== ".js")) continue;

    const fileName = basename(entry);
    if (fileName.startsWith("index.")) continue;
    if (fileName.endsWith(".d.ts")) continue;

    try {
      require(fullPath);
    } catch (error) {
      console.error(`[${label}] Failed to load ${fileName}:`, error);
    }
  }
}
