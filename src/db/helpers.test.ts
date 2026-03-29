import { describe, expect, test } from "bun:test";
import {
  deepClone,
  collectTouchedPaths,
  pruneConflictsFromSetOnInsert,
  buildSafeUpsertUpdate,
  unwrapFindOneAndUpdateResult,
} from "./helpers";

describe("deepClone", () => {
  test("returns a new object, not the same reference", () => {
    const obj = { a: 1, b: { c: 2 } };
    const clone = deepClone(obj);
    expect(clone).toEqual(obj);
    expect(clone).not.toBe(obj);
  });

  test("returns null as-is", () => {
    expect(deepClone(null)).toBeNull();
  });

  test("returns undefined as-is", () => {
    expect(deepClone(undefined)).toBeUndefined();
  });
});

describe("collectTouchedPaths", () => {
  test("collects paths from $set", () => {
    const paths = collectTouchedPaths({ $set: { name: "x", "a.b": 1 } });
    expect(paths.has("name")).toBe(true);
    expect(paths.has("a.b")).toBe(true);
  });

  test("excludes $setOnInsert paths", () => {
    const paths = collectTouchedPaths({ $setOnInsert: { name: "x" } });
    expect(paths.has("name")).toBe(false);
  });

  test("returns empty set for empty update", () => {
    expect(collectTouchedPaths({}).size).toBe(0);
  });

  test("collects both source and destination paths from $rename", () => {
    const paths = collectTouchedPaths({ $rename: { oldField: "newField" } });
    expect(paths.has("oldField")).toBe(true);
    expect(paths.has("newField")).toBe(true);
  });
});

describe("buildSafeUpsertUpdate", () => {
  test("adds updatedAt to $set by default", () => {
    const result = buildSafeUpsertUpdate(
      { $set: { name: "test" } },
      {},
      new Date("2025-01-01"),
    );
    expect((result as any).$set.updatedAt).toEqual(new Date("2025-01-01"));
  });

  test("does not add updatedAt when setUpdatedAt is false", () => {
    const result = buildSafeUpsertUpdate(
      { $setOnInsert: { _id: "x" } },
      {},
      new Date(),
      { setUpdatedAt: false },
    );
    expect((result as any).$set?.updatedAt).toBeUndefined();
  });

  test("merges defaults into $setOnInsert", () => {
    const result = buildSafeUpsertUpdate(
      { $set: { name: "test" } },
      { defaultField: "value" },
      new Date(),
    );
    expect((result as any).$setOnInsert?.defaultField).toBe("value");
  });

  test("does not add updatedAt when $currentDate.updatedAt is present", () => {
    const result = buildSafeUpsertUpdate(
      { $set: { name: "test" }, $currentDate: { updatedAt: true } },
      {},
      new Date("2025-01-01"),
    );
    expect((result as any).$set?.updatedAt).toBeUndefined();
  });
});

describe("unwrapFindOneAndUpdateResult", () => {
  test("returns null for null input", () => {
    expect(unwrapFindOneAndUpdateResult(null)).toBeNull();
  });

  test("returns document directly if not wrapped", () => {
    const doc = { _id: "test", name: "x" };
    expect(unwrapFindOneAndUpdateResult(doc)).toBe(doc);
  });

  test("unwraps legacy {value} wrapper", () => {
    const doc = { _id: "test" };
    expect(unwrapFindOneAndUpdateResult({ value: doc })).toBe(doc);
  });

  test("returns null for {value: null}", () => {
    expect(unwrapFindOneAndUpdateResult({ value: null })).toBeNull();
  });
});
