import { describe, expect, it } from "bun:test";
import type { AutoroleRuleValue } from "@/components/autorole-rule";
import {
  AUTOROLE_TOGGLE_PREFIX,
  autoroleButtonId,
  findButtonRules,
  findMessageRules,
  findReactRules,
  normalizeEmoji,
  parseAutoroleButtonId,
  parseDurationMs,
  timedGrantId,
} from "./rules";

function rule(
  name: string,
  patch: Partial<AutoroleRuleValue> & Pick<AutoroleRuleValue, "trigger" | "roleId">,
): AutoroleRuleValue {
  return {
    guildId: "guild-1",
    name,
    enabled: true,
    durationMs: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...patch,
  };
}

describe("autorole rule helpers", () => {
  it("parses compact durations and rejects invalid values", () => {
    expect(parseDurationMs(null)).toBeNull();
    expect(parseDurationMs("")).toBeNull();
    expect(parseDurationMs("30m")).toBe(30 * 60_000);
    expect(parseDurationMs("2h")).toBe(2 * 60 * 60_000);
    expect(parseDurationMs("7d")).toBe(7 * 24 * 60 * 60_000);
    expect(() => parseDurationMs("0m")).toThrow("Duration must be greater than zero.");
    expect(() => parseDurationMs("five")).toThrow("Use a duration like 30m, 2h, or 7d.");
  });

  it("normalizes unicode and custom emoji input", () => {
    expect(normalizeEmoji("✅")).toBe("✅");
    expect(normalizeEmoji("<:ship:123456789>")).toBe("ship:123456789");
    expect(normalizeEmoji("<a:dance:987654321>")).toBe("dance:987654321");
    expect(normalizeEmoji(" ship:123456789 ")).toBe("ship:123456789");
  });

  it("matches enabled reaction rules by message and emoji", () => {
    const rules = [
      rule("hit", { trigger: { type: "onReact", messageId: "m1", emoji: "✅" }, roleId: "r1" }),
      rule("wildcard", { trigger: { type: "onReact", messageId: "m1", emoji: "*" }, roleId: "r2" }),
      rule("wrong-message", {
        trigger: { type: "onReact", messageId: "m2", emoji: "✅" },
        roleId: "r3",
      }),
      rule("disabled", {
        enabled: false,
        trigger: { type: "onReact", messageId: "m1", emoji: "✅" },
        roleId: "r4",
      }),
    ];

    expect(findReactRules(rules, "m1", "✅").map((r) => r.name)).toEqual(["hit", "wildcard"]);
  });

  it("matches enabled message-content rules case-insensitively", () => {
    const rules = [
      rule("hit", { trigger: { type: "messageContains", keywords: ["alpha"] }, roleId: "r1" }),
      rule("miss", { trigger: { type: "messageContains", keywords: ["beta"] }, roleId: "r2" }),
      rule("disabled", {
        enabled: false,
        trigger: { type: "messageContains", keywords: ["alpha"] },
        roleId: "r3",
      }),
    ];

    expect(findMessageRules(rules, "ALPHA arrived").map((r) => r.name)).toEqual(["hit"]);
  });

  it("encodes button custom IDs and matches enabled button rules", () => {
    const customId = autoroleButtonId("m1", "r1");
    expect(customId.startsWith(AUTOROLE_TOGGLE_PREFIX)).toBe(true);
    expect(parseAutoroleButtonId(customId)).toEqual({ messageId: "m1", roleId: "r1" });

    const rules = [
      rule("hit", { trigger: { type: "onButton", messageId: "m1", label: "Join" }, roleId: "r1" }),
      rule("wrong-role", {
        trigger: { type: "onButton", messageId: "m1", label: "Join" },
        roleId: "r2",
      }),
      rule("wrong-message", {
        trigger: { type: "onButton", messageId: "m2", label: "Join" },
        roleId: "r1",
      }),
    ];

    expect(findButtonRules(rules, customId).map((r) => r.name)).toEqual(["hit"]);
  });

  it("uses a stable timed grant id", () => {
    expect(timedGrantId("g", "u", "r", "g:rule")).toBe("g:u:r:g:rule");
  });
});
