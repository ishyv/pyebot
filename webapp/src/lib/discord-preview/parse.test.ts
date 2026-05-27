import { describe, expect, test } from "vitest";
import { accentToHex, parsePayload, parsePayloadJson } from "./parse";

// A representative tycoon-console-shaped payload (container → text, separator,
// section+button, action row of buttons, a select), as discord.js would emit.
const SAMPLE = {
  flags: 1 << 15,
  components: [
    {
      type: 17,
      accent_color: 0x5865f2,
      components: [
        { type: 10, content: "# guild automated works" },
        { type: 14, divider: true, spacing: 1 },
        {
          type: 9,
          components: [{ type: 10, content: "iron works" }],
          accessory: { type: 2, style: 1, label: "manage" },
        },
        {
          type: 1,
          components: [
            { type: 2, style: 3, label: "collect ready" },
            { type: 2, style: 2, label: "refresh", disabled: true },
          ],
        },
        {
          type: 3,
          placeholder: "fix bottleneck...",
          options: [{ label: "iron — smelter", description: "lv 9 -> 10" }],
        },
      ],
    },
  ],
};

describe("accentToHex", () => {
  test("formats a 24-bit int as #rrggbb", () => {
    expect(accentToHex(0x5865f2)).toBe("#5865f2");
    expect(accentToHex(0)).toBe("#000000");
  });
  test("null/undefined accent yields null", () => {
    expect(accentToHex(null)).toBeNull();
    expect(accentToHex(undefined)).toBeNull();
  });
});

describe("parsePayload", () => {
  test("normalizes a full container payload", () => {
    const result = parsePayload(SAMPLE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [container] = result.nodes;
    expect(container.kind).toBe("container");
    if (container.kind !== "container") return;
    expect(container.accent).toBe("#5865f2");
    const kinds = container.children.map((c) => c.kind);
    expect(kinds).toEqual(["text", "separator", "section", "actionRow", "select"]);
  });

  test("section accessory button is normalized", () => {
    const result = parsePayload(SAMPLE);
    if (!result.ok) throw new Error("expected ok");
    const container = result.nodes[0];
    if (container.kind !== "container") throw new Error("expected container");
    const section = container.children.find((c) => c.kind === "section");
    expect(section?.kind).toBe("section");
    if (section?.kind !== "section") return;
    expect(section.accessory).toEqual({
      label: "manage",
      variant: "primary",
      disabled: false,
      url: null,
    });
  });

  test("button styles map to variants and disabled carries through", () => {
    const result = parsePayload(SAMPLE);
    if (!result.ok) throw new Error("expected ok");
    const container = result.nodes[0];
    if (container.kind !== "container") throw new Error("expected container");
    const row = container.children.find((c) => c.kind === "actionRow");
    if (row?.kind !== "actionRow") throw new Error("expected row");
    const [collect, refresh] = row.children;
    expect(collect).toMatchObject({ kind: "button", variant: "success", label: "collect ready" });
    expect(refresh).toMatchObject({ kind: "button", variant: "secondary", disabled: true });
  });

  test("accepts a bare components array", () => {
    const result = parsePayload([{ type: 10, content: "hi" }]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.nodes[0]).toEqual({ kind: "text", content: "hi" });
  });

  test("unknown component types degrade to a stub", () => {
    const result = parsePayload({ components: [{ type: 99 }] });
    if (!result.ok) throw new Error("expected ok");
    expect(result.nodes[0]).toEqual({ kind: "unknown", typeId: 99 });
  });

  test("rejects non-payload input", () => {
    expect(parsePayload(42).ok).toBe(false);
    expect(parsePayload({ nope: 1 }).ok).toBe(false);
  });
});

describe("parsePayloadJson", () => {
  test("surfaces JSON syntax errors as a failed result", () => {
    const result = parsePayloadJson("{ not json");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("invalid json");
  });

  test("parses a valid JSON string", () => {
    const result = parsePayloadJson(JSON.stringify(SAMPLE));
    expect(result.ok).toBe(true);
  });
});
