import { describe, expect, it } from "bun:test";
import { getHandleMetadata } from "@/framework/decorators";
import AdminPanelHandlers from "./handlers";
import { PANEL_PREFIX } from "./panelRuntime";

describe("admin panel handlers", () => {
  it("routes panel component custom ids through the framework router", () => {
    const metadata = getHandleMetadata(new AdminPanelHandlers());
    expect(metadata.map((entry) => entry.prefix)).toContain(PANEL_PREFIX);
  });
});
