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
    const rendered = JSON.stringify(payload.container.toJSON());

    expect(rendered).toContain("Link spam");
    expect(rendered).toContain("Tiered policy");
    expect(rendered).toContain("30d rolling");
    expect(rendered).toContain("2 links / 5s");
    expect(rendered).toContain("<#reports-1>");
    expect(rendered).not.toContain('"enabled"');
    expect(rendered).not.toContain("{\\n");
  });

  it("renders per-user slow role summaries", () => {
    const guild = GuildSchema.parse({
      _id: "guild-1",
      automod: {
        perUserSlow: {
          enabled: true,
          rules: [
            {
              enabled: true,
              roleId: "slow-role",
              cooldownSeconds: 30,
              durationSeconds: 3600,
            },
          ],
        },
      },
    });
    const session = new PanelSessionRegistry().create("user-1", "guild-1", "automod");
    session.selectedAutomodSection = "perUserSlow";

    const payload = renderAutomodPanel(session, guild);
    const rendered = JSON.stringify(payload.container.toJSON());

    expect(rendered).toContain("User slow roles");
    expect(rendered).toContain("30s cooldown");
    expect(rendered).toContain("3600s effect");
    expect(rendered).toContain("<@&slow-role>");
  });
});
