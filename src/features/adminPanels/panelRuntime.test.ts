import { describe, expect, it } from "bun:test";
import {
  makePanelCustomId,
  openPanelFromCommand,
  PANEL_TTL_MS,
  PanelSessionRegistry,
  panelContainer,
  withNavigationRows,
} from "./panelRuntime";

describe("panel runtime", () => {
  it("encodes panel custom ids through the route, preserving colon-bearing actions", () => {
    const registry = new PanelSessionRegistry();
    const session = registry.create("user-1", "guild-1", "channels");
    const customId = makePanelCustomId(session, "channels", "managed:add");

    // panel:c:{session}:{panel}:{action} — the action tail keeps its colon.
    expect(customId).toBe(`panel:c:${session.id}:channels:managed:add`);
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

    const payload = withNavigationRows(session, {
      container: panelContainer({ title: "Test" }),
      actionRows: rows,
    });

    expect(payload.actionRows).toHaveLength(5);
  });

  it("uses remaining action-row space for navigation", () => {
    const registry = new PanelSessionRegistry();
    const session = registry.create("user-1", "guild-1", "economy");
    const rows = [{}, {}, {}] as never[];

    const payload = withNavigationRows(session, {
      container: panelContainer({ title: "Test" }),
      actionRows: rows,
    });

    expect(payload.actionRows).toHaveLength(5);
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
      container: panelContainer({ title: "Test" }),
      actionRows: [],
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
      container: panelContainer({ title: "Test" }),
      actionRows: [],
    }));

    expect(calls).toEqual(["editReply"]);
  });
});
