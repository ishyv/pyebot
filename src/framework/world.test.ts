import { describe, expect, test } from "bun:test";
import { buildPatchUpdate } from "./world";

/**
 * Regression coverage for the `patchDirect` upsert bug.
 *
 * MongoDB throws ConflictingUpdateOperators (error 40) when the same field
 * path appears in both `$setOnInsert` and `$set` — validated at parse time for
 * BOTH insert and update paths. Since every component field has a Zod default,
 * the seeded insert-defaults always overlapped the caller's patch, so every
 * `ctx.patch()` threw — making RPG profile creation (and more) impossible.
 */
describe("buildPatchUpdate", () => {
  test("no key appears in both $setOnInsert and $set", () => {
    const defaults = { loadout: null, hpCurrent: 100, starterKitType: null, updatedAt: 0 };
    const patch = { loadout: { weapon: "x" }, starterKitType: "miner", updatedAt: 1 };
    const update = buildPatchUpdate("u1", defaults, patch);
    const insertKeys = Object.keys(update.$setOnInsert as object);
    const setKeys = Object.keys((update.$set as object) ?? {});
    for (const key of setKeys) {
      expect(insertKeys).not.toContain(key);
    }
  });

  test("patch wins: overlapping keys are kept only in $set", () => {
    const update = buildPatchUpdate("u1", { a: 1, b: 2, c: 3 }, { a: 99 });
    expect(update.$setOnInsert).toEqual({ _id: "u1", b: 2, c: 3 });
    expect(update.$set).toEqual({ a: 99 });
  });

  test("preserves non-patched defaults on $setOnInsert (filled on insert)", () => {
    const update = buildPatchUpdate("u1", { hpCurrent: 100, wins: 0 }, { wins: 5 });
    expect(update.$setOnInsert).toMatchObject({ hpCurrent: 100 });
    expect(update.$setOnInsert).not.toHaveProperty("wins");
  });

  test("empty patch yields no $set (MongoDB rejects an empty $set)", () => {
    const update = buildPatchUpdate("u1", { a: 1 }, {});
    expect(update.$set).toBeUndefined();
    expect(update.$setOnInsert).toEqual({ _id: "u1", a: 1 });
  });

  test("always seeds _id on $setOnInsert", () => {
    const update = buildPatchUpdate("u42", {}, { x: 1 });
    expect((update.$setOnInsert as { _id: string })._id).toBe("u42");
  });
});
