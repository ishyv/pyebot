/**
 * Registry of built-in scripts.
 *
 * Explicit imports (rather than a filesystem scan) keep the set type-checked and
 * obvious. Add a library script by dropping a module here and listing it.
 */
import type { StaticScript } from "./define";
import memberCount from "./member-count";

const ALL: StaticScript[] = [memberCount];

export const LIBRARY_SCRIPTS: ReadonlyMap<string, StaticScript> = new Map(
  ALL.map((script) => [script.name, script]),
);
