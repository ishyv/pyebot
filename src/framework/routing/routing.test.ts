import { describe, expect, it } from "bun:test";
import { int, oneOf, rest, snowflake, str } from "./codecs";
import { decodeArgs } from "./decode";
import { defineHandlers, isFeatureHandlers, on, routeHandlers } from "./registry";
import { defineRoutes, route } from "./routes";

describe("codecs", () => {
  it("round-trips primitives", () => {
    expect(str.decode(str.encode("hi"))).toBe("hi");
    expect(int.decode(int.encode(42))).toBe(42);
    expect(snowflake.decode(snowflake.encode("123"))).toBe("123");
  });

  it("rejects bad segments on decode", () => {
    expect(int.decode("not-a-number")).toBeNull();
    expect(int.decode("")).toBeNull();
    expect(snowflake.decode("abc")).toBeNull();
    expect(oneOf(["a", "b"]).decode("c")).toBeNull();
  });

  it("throws when encoding a colon into a non-greedy segment", () => {
    expect(() => str.encode("a:b")).toThrow();
    expect(() => snowflake.encode("a:b")).toThrow();
  });

  it("rest is greedy and colon-tolerant", () => {
    expect(rest.greedy).toBe(true);
    expect(rest.decode("a:b:c")).toBe("a:b:c");
  });
});

describe("decodeArgs", () => {
  const schema = { user: snowflake, choice: oneOf(["up", "down"]) };

  it("decodes positional segments", () => {
    expect(decodeArgs(schema, "123:up")).toEqual({ user: "123", choice: "up" });
  });

  it("returns null on arity mismatch", () => {
    expect(decodeArgs(schema, "123")).toBeNull();
    expect(decodeArgs(schema, "123:up:extra")).toBeNull();
  });

  it("returns null when a codec rejects its segment", () => {
    expect(decodeArgs(schema, "abc:up")).toBeNull(); // bad snowflake
    expect(decodeArgs(schema, "123:sideways")).toBeNull(); // bad enum
  });

  it("greedy last field absorbs trailing colons", () => {
    const s = { id: snowflake, body: rest };
    expect(decodeArgs(s, "123:a:b:c")).toEqual({ id: "123", body: "a:b:c" });
  });

  it("empty remainder decodes a zero-field schema", () => {
    expect(decodeArgs({}, "")).toEqual({});
  });
});

describe("defineRoutes", () => {
  const routes = defineRoutes("example", {
    greet: { target: snowflake },
    pick: route({ session: str }, "select"),
    ping: {},
    note: { id: snowflake, text: rest },
  });

  it("encodes ns:route:args with a trailing colon for zero-arg routes", () => {
    expect(routes.greet.id({ target: "123" })).toBe("example:greet:123");
    expect(routes.ping.id({})).toBe("example:ping:");
    expect(routes.greet.prefix).toBe("example:greet:");
  });

  it("carries the declared component kind", () => {
    expect(routes.greet.kind).toBe("button");
    expect(routes.pick.kind).toBe("select");
  });

  it("builds a button with the customId prefilled", () => {
    const b = routes.greet.button({ target: "123" }, { label: "Hi" });
    expect(b.toJSON()).toMatchObject({ custom_id: "example:greet:123", label: "Hi" });
  });

  it("round-trips through decodeArgs", () => {
    const id = routes.note.id({ id: "123", text: "a:b" });
    const remainder = id.slice(routes.note.prefix.length);
    expect(decodeArgs(routes.note.schema, remainder)).toEqual({ id: "123", text: "a:b" });
  });

  it("rejects a greedy field that is not last", () => {
    expect(() => defineRoutes("x", { bad: { body: rest, id: snowflake } })).toThrow();
  });

  it("rejects invalid namespace/route names", () => {
    expect(() => defineRoutes("Bad NS", { a: {} })).toThrow();
    expect(() => defineRoutes("ok", { "Bad Name": {} })).toThrow();
  });
});

describe("routeHandlers + registrations", () => {
  const routes = defineRoutes("example", { greet: { target: snowflake } });

  it("produces one component registration per handled route that decodes + dispatches", async () => {
    const seen: Array<{ target: string }> = [];
    const regs = routeHandlers(routes, {
      greet: async (_i, args) => {
        seen.push(args);
      },
    });
    expect(regs).toHaveLength(1);
    const reg = regs[0];
    if (reg?.kind !== "component") throw new Error("expected component registration");
    expect(reg.prefix).toBe("example:greet:");

    // valid id → handler runs with decoded args
    // biome-ignore lint/suspicious/noExplicitAny: minimal fake interaction for the test
    await reg.run({ customId: "example:greet:123" } as any, {} as any);
    expect(seen).toEqual([{ target: "123" }]);

    // garbled id → skipped (no throw, no extra call)
    // biome-ignore lint/suspicious/noExplicitAny: minimal fake interaction for the test
    await reg.run({ customId: "example:greet:abc" } as any, {} as any);
    expect(seen).toHaveLength(1);
  });

  it("defineHandlers wraps a registration list the loader can detect", () => {
    class Evt {}
    const handlers = defineHandlers([
      ...routeHandlers(routes, { greet: async () => {} }),
      on(Evt, async () => {}),
    ]);
    expect(isFeatureHandlers(handlers)).toBe(true);
    expect(isFeatureHandlers({})).toBe(false);
    expect(handlers.registrations).toHaveLength(2);
  });
});
