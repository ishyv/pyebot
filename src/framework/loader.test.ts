import { describe, expect, it } from "bun:test";
import { loadFeatures } from "./loader";

describe("feature loader command discovery", () => {
  it("loads every direct command module from the real feature tree", async () => {
    const features = await loadFeatures();
    const automod = features.find((feature) => feature.descriptor.id === "automod");

    expect(features.length).toBeGreaterThan(0);
    expect(automod?.commands.map((command) => command.data.name)).toContain("automod");
  });
});
