import { describe, expect, it } from "bun:test";
import { defineFeature } from "./feature";

describe("defineFeature", () => {
  it("returns the descriptor unchanged", () => {
    const descriptor = {
      id: "utility",
      name: "Utility",
      description: "Small quality-of-life commands.",
      defaultEnabled: true,
    } as const;

    expect(defineFeature(descriptor)).toBe(descriptor);
  });

  it("accepts only supported descriptor fields at compile time", () => {
    const accepted = defineFeature({
      id: "accepted",
      name: "Accepted",
      description: "Supported descriptor shape.",
      defaultEnabled: false,
    });

    expect(accepted.id).toBe("accepted");

    defineFeature({
      id: "bad",
      name: "Bad",
      description: "Bad descriptor.",
      // @ts-expect-error Feature descriptors must not accept unsupported metadata.
      gate: "bad",
    });
  });
});
