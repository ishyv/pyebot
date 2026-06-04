/**
 * Pure-logic coverage for the entity store: the namespaced upsert builder and
 * the selector-to-path resolver. The Mongo-talking methods of `EntityStore`
 * are exercised by the prototype slice and typecheck, mirroring how `world.ts`
 * unit-tests only `buildPatchUpdate`.
 */

import { describe, expect, test } from "bun:test";
import { buildComponentUpdate, selectorPath } from "./entity-store";

describe("buildComponentUpdate", () => {
  test("namespaces patch keys under the component field in $set", () => {
    const update = buildComponentUpdate("u1", "counter", { count: 0, lastAt: null }, { count: 5 });
    expect(update.$set).toEqual({ "counter.count": 5 });
  });

  test("seeds non-patched defaults under the component field on insert", () => {
    const update = buildComponentUpdate("u1", "counter", { count: 0, lastAt: null }, { count: 5 });
    expect(update.$setOnInsert).toEqual({ _id: "u1", "counter.lastAt": null });
  });

  test("patch wins: no namespaced key appears in both $set and $setOnInsert", () => {
    const update = buildComponentUpdate("u1", "wallet", { coins: 0, gems: 0 }, { coins: 100 });
    const insertKeys = Object.keys(update.$setOnInsert as object);
    const setKeys = Object.keys((update.$set as object) ?? {});
    for (const key of setKeys) expect(insertKeys).not.toContain(key);
  });

  test("empty patch yields no $set, just the seeded defaults", () => {
    const update = buildComponentUpdate("u1", "counter", { count: 0 }, {});
    expect(update.$set).toBeUndefined();
    expect(update.$setOnInsert).toEqual({ _id: "u1", "counter.count": 0 });
  });

  test("always seeds _id on $setOnInsert", () => {
    const update = buildComponentUpdate("u42", "x", {}, { a: 1 });
    expect((update.$setOnInsert as { _id: string })._id).toBe("u42");
  });
});

describe("selectorPath", () => {
  test("resolves a single property", () => {
    expect(selectorPath<{ count: number }>((c) => c.count)).toBe("count");
  });

  test("resolves a nested property chain", () => {
    expect(selectorPath<{ balances: { coins: number } }>((c) => c.balances.coins)).toBe(
      "balances.coins",
    );
  });

  test("throws when the selector reads nothing", () => {
    expect(() => selectorPath<{ count: number }>((c) => c)).toThrow(/at least one property/);
  });
});
