import { describe, expect, test } from "bun:test";
import tickets from "@/features/tickets";
import { compileFeatureClass } from "@/framework/decorators";

describe("tickets decorated feature", () => {
  test("compiles into the runtime registry shape", () => {
    const feature = compileFeatureClass(tickets);

    expect(feature.id).toBe("tickets");
    expect(feature.featureGate).toBe("tickets");
    expect(feature.commands.map((command) => command.data.name)).toEqual(["ticket"]);
    expect(feature.components?.[0]?.matches("tickets:close:123")).toBe(true);
  });
});
