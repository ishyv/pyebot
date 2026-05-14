import { describe, expect, it } from "bun:test";
import { data as expeditionData } from "./expedition";
import { data as hideoutData } from "./hideout";

describe("RPG command help entry points", () => {
  it("lets /expedition be run without required options so it can show help", () => {
    const json = expeditionData.toJSON() as {
      options?: Array<{ name: string; required?: boolean }>;
    };

    expect(json.options?.some((option) => option.required === true)).toBe(false);
  });

  it("adds /hideout help", () => {
    const json = hideoutData.toJSON() as { options?: Array<{ name: string }> };

    expect(json.options?.some((option) => option.name === "help")).toBe(true);
  });
});
