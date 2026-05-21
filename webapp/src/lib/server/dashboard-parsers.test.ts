import { describe, expect, test } from "bun:test";
import {
  parseAutomodPatch,
  parseDailyEconomyPatch,
  parseModerationAction,
  parseTaxEconomyPatch,
} from "./dashboard-parsers";

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

describe("dashboard form parsers", () => {
  test("parses moderation timeout without unsafe casts", () => {
    const parsed = parseModerationAction(
      form({
        type: "timeout",
        targetUserId: "user-1",
        reason: "spam",
        durationMs: "60000",
      }),
      "mod-1",
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value).toEqual({
        type: "timeout",
        moderatorId: "mod-1",
        targetUserId: "user-1",
        reason: "spam",
        durationMs: 60000,
      });
    }
  });

  test("rejects invalid moderation actions", () => {
    const parsed = parseModerationAction(form({ type: "launch", targetUserId: "user-1" }), "mod-1");
    expect(parsed).toEqual({ ok: false, error: "Unknown moderation action" });
  });

  test("rejects non-numeric economy values", () => {
    expect(parseDailyEconomyPatch(form({ reward: "lots" }))).toEqual({
      ok: false,
      error: "reward must be numeric.",
    });
  });

  test("rejects out-of-range tax rates", () => {
    expect(parseTaxEconomyPatch(form({ rate: "2" }))).toEqual({
      ok: false,
      error: "rate must be between 0 and 1.",
    });
  });

  test("parses per-user slow role rules", () => {
    const parsed = parseAutomodPatch(
      form({
        enabled: "on",
        rules: JSON.stringify([
          {
            enabled: true,
            roleId: "slow-role",
            cooldownSeconds: 30,
            durationSeconds: 3600,
          },
        ]),
      }),
      "perUserSlow",
    );

    expect(parsed).toEqual({
      ok: true,
      value: {
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
  });

  test("rejects too-short per-user slow effect durations", () => {
    expect(
      parseAutomodPatch(
        form({
          rules: JSON.stringify([
            {
              enabled: true,
              roleId: "slow-role",
              cooldownSeconds: 30,
              durationSeconds: 30,
            },
          ]),
        }),
        "perUserSlow",
      ),
    ).toEqual({ ok: false, error: "durationSeconds must be at least 60." });
  });
});
