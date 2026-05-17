import { describe, expect, it } from "bun:test";
import { applyFeatureOverride, resolveFeatureEnabled } from "@/components/guild-features";
import { isFeatureEnabled } from "@/framework/middleware";
import type { Ctx, FeatureDescriptor } from "@/framework/types";

const defaultEnabledFeature: FeatureDescriptor = {
  id: "economy",
  name: "Economy",
  description: "Economy commands.",
  defaultEnabled: true,
};

const defaultDisabledFeature: FeatureDescriptor = {
  id: "counting",
  name: "Counting",
  description: "Counting game.",
  defaultEnabled: false,
};

describe("GuildFeatures toggle resolution", () => {
  it("uses feature defaults when no override exists", () => {
    expect(resolveFeatureEnabled(defaultEnabledFeature, {})).toBe(true);
    expect(resolveFeatureEnabled(defaultDisabledFeature, {})).toBe(false);
  });

  it("lets explicit false disable a default-enabled feature", () => {
    expect(resolveFeatureEnabled(defaultEnabledFeature, { economy: false })).toBe(false);
  });

  it("lets explicit true enable a default-disabled feature", () => {
    expect(resolveFeatureEnabled(defaultDisabledFeature, { counting: true })).toBe(true);
  });

  it("applies overrides in the same state shape middleware reads", async () => {
    const state = applyFeatureOverride({ overrides: {} }, "counting", true);
    const ctx = {
      get: async () => state,
    } as unknown as Ctx;

    await expect(isFeatureEnabled(ctx, "guild-1", defaultDisabledFeature)).resolves.toBe(true);
  });
});
