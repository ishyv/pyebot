import { afterEach, describe, expect, it } from "vitest";
import { getBridge, hasBridge } from "./bridge";

afterEach(() => {
  delete (globalThis as unknown as { __txBotBridge__?: unknown }).__txBotBridge__;
});

describe("webapp bridge accessor", () => {
  it("reports the embedded bot bridge availability from globalThis", () => {
    delete (globalThis as unknown as { __txBotBridge__?: unknown }).__txBotBridge__;
    expect(hasBridge()).toBe(false);

    const bridge = { events: { on() {} } };
    (globalThis as unknown as { __txBotBridge__?: unknown }).__txBotBridge__ = { bridge };

    expect(hasBridge()).toBe(true);
    expect(getBridge()).toBe(bridge);
  });
});
