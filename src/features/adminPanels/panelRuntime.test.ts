import { describe, expect, it } from "bun:test";
import {
  PANEL_TTL_MS,
  PanelSessionRegistry,
  makePanelCustomId,
  parsePanelCustomId,
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
});

