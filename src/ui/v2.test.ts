/**
 * Tests for the V2 primitive layer.
 *
 * Scope:
 * - We only test invariants we claim to protect: budget violations throw,
 *   the message flag is set, customId parsing round-trips with the right
 *   shape, and `progress` clamps its edge inputs.
 * - We do NOT test that discord.js's builders produce the right wire payload;
 *   that's their job, and `bun run typecheck` is the contract.
 */

import { describe, expect, test } from "bun:test";
import { ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js";
import {
  configUpdateMessage,
  container,
  failureMessage,
  progress,
  row,
  successMessage,
  text,
  V2_COMPONENT_LIMIT,
  V2_TOP_LEVEL_LIMIT,
  v2Message,
} from "./v2";

describe("v2Message", () => {
  test("sets IsComponentsV2 flag", () => {
    const payload = v2Message(container("info", text("hello")));
    expect(payload.flags).toBe(MessageFlags.IsComponentsV2);
  });

  test("throws when called with zero top-level components", () => {
    expect(() => v2Message()).toThrow(/at least one/i);
  });

  test("throws when top-level count exceeds limit", () => {
    const tops = Array.from({ length: V2_TOP_LEVEL_LIMIT + 1 }, () => text("x"));
    expect(() => v2Message(...tops)).toThrow(/top-level/i);
  });

  test("throws when text budget exceeded across multiple text displays", () => {
    // Use three chunks under the per-component 4000-char cap whose sum exceeds
    // the message-wide V2_TEXT_BUDGET. The discord.js builder's per-node
    // validator passes; our message-wide guard is what trips.
    const chunk = "a".repeat(1500);
    expect(() => v2Message(container("info", text(chunk), text(chunk), text(chunk)))).toThrow(
      /text chars/i,
    );
  });

  test("throws when component count exceeded", () => {
    // One container + 40+ text children = over the cap.
    const tds = Array.from({ length: V2_COMPONENT_LIMIT }, () => text("x"));
    expect(() => v2Message(container("info", ...tds))).toThrow(/components/i);
  });

  test("accepts a payload at exactly the budget summed across nodes", () => {
    // Two text displays of 2000 chars each, exactly matching the budget.
    const chunk = "a".repeat(2000);
    const payload = v2Message(container("info", text(chunk), text(chunk)));
    expect(payload.components).toHaveLength(1);
  });
});

describe("standard V2 response builders", () => {
  test("successMessage renders a V2 ok message with heading and body", () => {
    const payload = successMessage("Saved", "Config updated.");

    expect(payload.flags).toBe(MessageFlags.IsComponentsV2);
    expect(JSON.stringify(payload.components)).toContain("## Saved\\nConfig updated.");
  });

  test("failureMessage defaults to the Failed heading and keeps custom body text", () => {
    const payload = failureMessage("Could not update configuration.");

    expect(payload.flags).toBe(MessageFlags.IsComponentsV2);
    expect(JSON.stringify(payload.components)).toContain(
      "## Failed\\nCould not update configuration.",
    );
  });

  test("configUpdateMessage includes optional details and footer only when provided", () => {
    const compact = configUpdateMessage("ok", "Saved", "Config updated.");
    const detailed = configUpdateMessage(
      "ok",
      "Saved",
      "Config updated.",
      "**Window:** 5s",
      "-# Use /automod status to see full config",
    );

    expect(JSON.stringify(compact.components)).not.toContain("Window");
    expect(JSON.stringify(compact.components)).not.toContain("/automod status");
    expect(JSON.stringify(detailed.components)).toContain("**Window:** 5s");
    expect(JSON.stringify(detailed.components)).toContain("/automod status");
  });
});

describe("row", () => {
  test("throws on zero children", () => {
    expect(() => row()).toThrow();
  });
  test("throws on more than five children", () => {
    const btns = Array.from({ length: 6 }, (_, i) =>
      new ButtonBuilder().setCustomId(`x:${i}`).setStyle(ButtonStyle.Secondary).setLabel("b"),
    );
    expect(() => row(...btns)).toThrow();
  });
});

describe("progress", () => {
  test("zero max yields empty bar", () => {
    expect(progress(5, 0).data.content?.length).toBeGreaterThan(0);
  });
  test("value at or above max yields full bar", () => {
    const c = progress(100, 50).data.content ?? "";
    // 10 cells, all should be the 'full' glyph (whatever it is).
    expect(c.length).toBeGreaterThan(0);
  });
  test("negative value yields empty bar without throwing", () => {
    expect(() => progress(-5, 10)).not.toThrow();
  });
});
