/**
 * Tests for the entity-component declarations. Covers the descriptor identity
 * of `entity()`/`defineComponent()` and the read-boundary behavior of
 * `parseComponentField` (defaults on absence, fill on partial, throw on
 * malformed). No MongoDB — these are pure.
 */

import { describe, expect, it } from "bun:test";
import { z } from "zod";
import { defineComponent, entity, parseComponentField } from "./entity";

const User = entity("users");

const Counter = defineComponent(
  User,
  "counter",
  z.object({
    count: z.number().int().min(0).default(0),
    lastAt: z.coerce.date().nullable().default(null),
  }),
);

describe("entity() / defineComponent()", () => {
  it("records the collection on the kind", () => {
    expect(User.collection).toBe("users");
  });

  it("binds the component to its kind, name, and schema", () => {
    expect(Counter.kind).toBe(User);
    expect(Counter.name).toBe("counter");
    expect(Counter.schema.parse({}).count).toBe(0);
  });
});

describe("parseComponentField()", () => {
  it("fills defaults when the field is absent", () => {
    const value = parseComponentField(Counter, undefined);
    expect(value).toEqual({ count: 0, lastAt: null });
  });

  it("fills missing keys on a partial stored field", () => {
    const value = parseComponentField(Counter, { count: 7 });
    expect(value).toEqual({ count: 7, lastAt: null });
  });

  it("coerces stored values through the schema", () => {
    const value = parseComponentField(Counter, { count: 3, lastAt: "2026-06-04T00:00:00.000Z" });
    expect(value.lastAt).toBeInstanceOf(Date);
  });

  it("throws on a present-but-malformed field (the read boundary)", () => {
    expect(() => parseComponentField(Counter, { count: -1 })).toThrow(/counter/);
  });
});
