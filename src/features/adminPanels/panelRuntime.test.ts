import { describe, expect, it } from "bun:test";
import {
  makePanelCustomId,
  openPanelFromCommand,
  PANEL_TTL_MS,
  PanelSessionRegistry,
  parsePanelCustomId,
  withNavigationRows,
} from "./panelRuntime";

describe("panel runtime", () => {
  it("parses panel custom ids", () => {
    const registry = new PanelSessionRegistry();
    const session = registry.create("user-1", "guild-1", "channels");
    const customId = makePanelCustomId(session, "channels", "managed:add");

    expect(parsePanelCustomId(customId)).toEqual({
      sessionId: session.id,
      panelId: "channels",
      action: "managed:add",
    });
  });

  it("rejects malformed custom ids", () => {
    expect(parsePanelCustomId("nope")).toBeNull();
    expect(parsePanelCustomId("panel:abc:not-a-panel:refresh")).toBeNull();
    expect(parsePanelCustomId("panel:abc:channels")).toBeNull();
  });

  it("purges expired sessions", () => {
    const registry = new PanelSessionRegistry();
    const session = registry.create("user-1", "guild-1", "channels");
    session.updatedAt = Date.now() - PANEL_TTL_MS - 1;

    expect(registry.get(session.id)).toBeNull();
    expect(registry.size()).toBe(0);
  });

  it("keeps panel payloads inside Discord's five action-row limit", () => {
    const registry = new PanelSessionRegistry();
    const session = registry.create("user-1", "guild-1", "channels");
    const rows = [{}, {}, {}, {}, {}] as never[];

    const payload = withNavigationRows(session, { embeds: [], components: rows });

    expect(payload.components).toHaveLength(5);
  });

  it("uses remaining action-row space for navigation", () => {
    const registry = new PanelSessionRegistry();
    const session = registry.create("user-1", "guild-1", "economy");
    const rows = [{}, {}, {}] as never[];

    const payload = withNavigationRows(session, { embeds: [], components: rows });

    expect(payload.components).toHaveLength(5);
  });

  it("replies when opening a panel from a fresh command interaction", async () => {
    const calls: string[] = [];
    const interaction = {
      guildId: "guild-1",
      user: { id: "user-1" },
      deferred: false,
      replied: false,
      async reply() {
        calls.push("reply");
      },
      async editReply() {
        calls.push("editReply");
      },
      async followUp() {
        calls.push("followUp");
      },
    } as never;

    await openPanelFromCommand(interaction, "moderation", async () => ({
      embeds: [],
      components: [],
    }));

    expect(calls).toEqual(["reply"]);
  });

  it("edits the deferred reply when opening a panel from an acknowledged command", async () => {
    const calls: string[] = [];
    const interaction = {
      guildId: "guild-1",
      user: { id: "user-1" },
      deferred: true,
      replied: false,
      async reply() {
        calls.push("reply");
      },
      async editReply() {
        calls.push("editReply");
      },
      async followUp() {
        calls.push("followUp");
      },
    } as never;

    await openPanelFromCommand(interaction, "moderation", async () => ({
      embeds: [],
      components: [],
    }));

    expect(calls).toEqual(["editReply"]);
  });
});
