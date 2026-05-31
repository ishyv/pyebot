/**
 * Pure utilities for constructing safe MongoDB update documents.
 *
 * MongoDB rejects upserts when the same path is touched by both `$set` and
 * `$setOnInsert`, even if the conflicting branch would not run for the current
 * document. These helpers normalize update documents before they cross the DB
 * boundary so repository code can merge schema defaults with caller patches.
 *
 * Side effects: none. These functions do not open connections or mutate their
 * inputs; callers own persistence and schema validation.
 */

import type { UpdateFilter } from "mongodb";

/** Deep-clones `value` using structuredClone. Returns null/undefined as-is. */
export function deepClone<T>(value: T): T {
  if (value === null || value === undefined) return value;
  return structuredClone(value);
}

const UPDATE_OPERATORS = new Set([
  "$set",
  "$unset",
  "$inc",
  "$mul",
  "$push",
  "$addToSet",
  "$pull",
  "$pullAll",
  "$pop",
  "$min",
  "$max",
  "$currentDate",
  "$bit",
  "$rename",
  "$setOnInsert",
]);

const UPDATE_OPERATORS_EXCLUDED_FROM_TOUCH = new Set(["$setOnInsert"]);

const isOperatorUpdate = (update: Record<string, unknown>): boolean =>
  Object.keys(update).some((key) => key.startsWith("$"));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

/**
 * Collects the top-level field paths touched by a MongoDB update document.
 * Paths inside `$setOnInsert` are excluded — those are defaults, not mutations.
 */
export function collectTouchedPaths(update: UpdateFilter<unknown>): Set<string> {
  const touched = new Set<string>();
  if (!update || typeof update !== "object") return touched;

  const updateDoc = update as Record<string, unknown>;
  if (!isOperatorUpdate(updateDoc)) {
    for (const key of Object.keys(updateDoc)) {
      if (key) touched.add(key);
    }
    return touched;
  }

  for (const [operator, payload] of Object.entries(updateDoc)) {
    if (!operator.startsWith("$")) continue;
    if (!UPDATE_OPERATORS.has(operator)) continue;
    if (UPDATE_OPERATORS_EXCLUDED_FROM_TOUCH.has(operator)) continue;
    if (!isRecord(payload)) continue;
    if (operator === "$rename") {
      // WHY: both old and new names are unsafe for insert defaults. Preserving
      // either in `$setOnInsert` can still create conflicting update paths.
      for (const [from, to] of Object.entries(payload)) {
        if (from) touched.add(from);
        if (typeof to === "string" && to) touched.add(to);
      }
      continue;
    }
    for (const key of Object.keys(payload)) {
      if (key) touched.add(key);
    }
  }
  return touched;
}

/**
 * Removes fields from `$setOnInsert` that would conflict with paths already present
 * in the rest of the update (via `$set`, `$inc`, etc.). Also always drops `updatedAt`
 * from `$setOnInsert` because `buildSafeUpsertUpdate` stamps it into `$set`.
 */
export function pruneConflictsFromSetOnInsert(
  setOnInsert: Record<string, unknown> | undefined,
  touchedPaths: Iterable<string>,
): Record<string, unknown> | undefined {
  if (!setOnInsert) return setOnInsert;
  const pruned: Record<string, unknown> = {};
  const touched = Array.from(touchedPaths ?? []);
  outer: for (const [key, value] of Object.entries(setOnInsert)) {
    if (key === "updatedAt") continue;
    for (const path of touched) {
      if (!path) continue;
      if (key === path) continue outer;
      if (key.startsWith(`${path}.`)) continue outer;
      if (path.startsWith(`${key}.`)) continue outer;
    }
    pruned[key] = value;
  }
  return pruned;
}

/**
 * Builds a safe MongoDB upsert update by:
 * - Injecting `updatedAt: now` into `$set` (unless `setUpdatedAt: false` or `$currentDate.updatedAt` is present)
 * - Merging `defaults` into `$setOnInsert`
 * - Pruning `$setOnInsert` fields that conflict with explicit update paths
 *
 * Returns a new update object. `defaults` should be trusted schema defaults,
 * not arbitrary user input.
 */
export function buildSafeUpsertUpdate<TSchema>(
  update: UpdateFilter<TSchema>,
  defaults: Record<string, unknown>,
  now: Date = new Date(),
  options: { setUpdatedAt?: boolean } = {},
): UpdateFilter<TSchema> {
  if (!update || typeof update !== "object") return update;
  const updateDoc = update as Record<string, unknown>;
  if (!isOperatorUpdate(updateDoc)) return update;

  const existingSet = (updateDoc.$set as Record<string, unknown> | undefined) ?? {};
  const existingSetOnInsert = (updateDoc.$setOnInsert as Record<string, unknown> | undefined) ?? {};

  const touched = collectTouchedPaths(update);
  const mergedSetOnInsert = { ...(defaults ?? {}), ...(existingSetOnInsert ?? {}) };
  const prunedSetOnInsert = pruneConflictsFromSetOnInsert(mergedSetOnInsert, touched);

  const nextSet = { ...existingSet };
  const shouldSetUpdatedAt = options.setUpdatedAt !== false;
  const hasCurrentDate =
    isRecord(updateDoc.$currentDate) && Object.hasOwn(updateDoc.$currentDate, "updatedAt");

  if (shouldSetUpdatedAt && !hasCurrentDate) nextSet.updatedAt = now;

  // WHY: MongoDB's generic `UpdateFilter` is stricter than the dynamic operator
  // rewrite. Keep the messy cast at the boundary instead of spreading casts
  // through every repository call site.
  const nextUpdate: Record<string, unknown> = { ...update };

  if (Object.keys(nextSet).length > 0) {
    nextUpdate.$set = nextSet;
  } else if (nextUpdate.$set) {
    delete nextUpdate.$set;
  }

  if (prunedSetOnInsert && Object.keys(prunedSetOnInsert).length > 0) {
    nextUpdate.$setOnInsert = prunedSetOnInsert;
  } else if (nextUpdate.$setOnInsert) {
    delete nextUpdate.$setOnInsert;
  }

  return nextUpdate as UpdateFilter<TSchema>;
}
