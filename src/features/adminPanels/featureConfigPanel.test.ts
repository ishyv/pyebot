import { describe, expect, it } from "bun:test";
import { GuildSchema } from "@/db/schemas/guild";
import countingFeature from "@/features/counting";
import { compileFeatureClass } from "@/framework/decorators";
import { PanelSessionRegistry } from "./panelRuntime";
import { renderFeatureConfigPanel } from "./panels";

describe("feature config admin panel", () => {
  it("lists declared counting config fields", () => {
    const guild = GuildSchema.parse({ _id: "guild-1" });
    const session = new PanelSessionRegistry().create("user-1", "guild-1", "feature-config");
    const payload = renderFeatureConfigPanel(session, guild, [compileFeatureClass(countingFeature)]);

    expect(payload.embeds[0]?.toJSON().title).toBe("Feature Config Panel");
    expect(JSON.stringify(payload.embeds[0]?.toJSON())).toContain("Counting channel");
    expect(payload.components.length).toBeGreaterThan(0);
  });
});
