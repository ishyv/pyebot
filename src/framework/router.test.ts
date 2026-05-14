/**
 * Tests for ComponentRouter — longest-prefix-wins resolution.
 */

import { describe, expect, it } from "bun:test";
import { ComponentRouter } from "./router";

describe("ComponentRouter", () => {
  it("returns the route matching the customId prefix", () => {
    const router = new ComponentRouter();
    router.add("foo:", "f1", async () => {});
    router.add("bar:", "f2", async () => {});
    expect(router.resolve("foo:click:1")?.featureId).toBe("f1");
    expect(router.resolve("bar:")?.featureId).toBe("f2");
    expect(router.resolve("baz:")).toBeNull();
  });

  it("prefers the longest matching prefix", () => {
    const router = new ComponentRouter();
    router.add("market:", "general", async () => {});
    router.add("market:confirm:", "specific", async () => {});
    expect(router.resolve("market:browse:1")?.featureId).toBe("general");
    expect(router.resolve("market:confirm:42")?.featureId).toBe("specific");
  });
});
