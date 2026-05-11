import { describe, expect, it } from "bun:test";
import { compileFeatureClass } from "@/framework/decorators";
import AutomodFeature from "./index";

describe("automod feature", () => {
  it("leaves the config command reachable when automod is disabled", () => {
    const feature = compileFeatureClass(AutomodFeature);

    expect(feature.featureGate).toBeUndefined();
    expect(feature.commands.map((command) => command.data.name)).toContain("automod");
  });
});
