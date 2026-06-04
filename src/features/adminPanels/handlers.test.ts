import { describe, expect, it } from "bun:test";
import handlers from "./handlers";
import { panelRoutes } from "./routes";

describe("admin panel handlers", () => {
  it("registers a component route for the panel catch-all prefix", () => {
    const prefixes = handlers.registrations
      .filter((r) => r.kind === "component")
      .map((r) => r.prefix);
    expect(prefixes).toContain(panelRoutes.c.prefix);
    expect(panelRoutes.c.prefix).toBe("panel:c:");
  });
});
