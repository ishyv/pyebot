import { describe, expect, it } from "bun:test";
import { GuildSchema } from "@/db/schemas/guild";
import { PanelSessionRegistry } from "./panelRuntime";
import { renderAutomodPanel } from "./panels";

describe("automod admin panel", () => {
  it("renders readable status summaries instead of raw JSON", () => {
    const guild = GuildSchema.parse({
      _id: "guild-1",
      automod: {
        linkSpam: {
          enabled: true,
          maxLinks: 2,
          windowSeconds: 5,
          timeoutSeconds: 300,
          action: "delete",
          reportChannelId: "reports-1",
        },
        customPatterns: [
          {
            name: "invite",
            pattern: "discord\\.gg",
            flags: "i",
            action: "delete",
            timeoutSeconds: 300,
          },
        ],
      },
    });
    const session = new PanelSessionRegistry().create("user-1", "guild-1", "automod");
    session.selectedAutomodSection = "linkSpam";

    const payload = renderAutomodPanel(session, guild);
    const embed = payload.embeds[0]?.toJSON();
    const rendered = JSON.stringify(embed);

    expect(rendered).toContain("Link spam");
    expect(rendered).toContain("Tiered policy");
    expect(rendered).toContain("30d rolling");
    expect(rendered).toContain("2 links / 5s");
    expect(rendered).toContain("<#reports-1>");
    expect(rendered).not.toContain('"enabled"');
    expect(rendered).not.toContain("{\\n");
  });
});
