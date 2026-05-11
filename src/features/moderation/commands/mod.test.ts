import { describe, expect, it } from "bun:test";
import { compileFeatureClass } from "@/framework/decorators";
import ModerationFeature from "../index";
import { buildModHelpEmbed, data } from "./mod";

describe("/mod help", () => {
  it("registers a moderation help command on the feature", () => {
    const feature = compileFeatureClass(ModerationFeature);

    expect(feature.commands.map((command) => command.data.name)).toContain("mod");
  });

  it("exposes a help subcommand", () => {
    const json = data.toJSON() as { name: string; options?: Array<{ name: string }> };

    expect(json.name).toBe("mod");
    expect(json.options?.some((option) => option.name === "help")).toBe(true);
  });

  it("renders setup, daily-use, automod, and safety guidance", () => {
    const rendered = JSON.stringify(buildModHelpEmbed().toJSON());

    expect(rendered).toContain("First setup");
    expect(rendered).toContain("/modset panel");
    expect(rendered).toContain("/automod status");
    expect(rendered).toContain("Safety");
  });
});
