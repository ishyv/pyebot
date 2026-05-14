/**
 * Tests for the `component()` helper. Verifies it preserves the input
 * verbatim and that TypeScript inference works as documented (compile-
 * time only, no runtime assertion).
 */

import { describe, expect, it } from "bun:test";
import { z } from "zod";
import { component } from "./component";

describe("component()", () => {
  it("returns the descriptor unchanged", () => {
    const schema = z.object({ a: z.number() });
    const c = component({ collection: "things", schema });
    expect(c.collection).toBe("things");
    expect(c.schema).toBe(schema);
  });

  it("schema parses with defaults", () => {
    const c = component({
      collection: "x",
      schema: z.object({ count: z.number().default(0), name: z.string().default("") }),
    });
    const parsed = c.schema.parse({});
    expect(parsed.count).toBe(0);
    expect(parsed.name).toBe("");
  });
});
