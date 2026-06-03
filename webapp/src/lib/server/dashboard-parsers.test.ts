import { describe, expect, test } from "vitest";
import {
  parseAutomodPatch,
  parseBannedImageTest,
  parseBannedImageUpload,
  parseDailyEconomyPatch,
  parseModerationAction,
  parseTaxEconomyPatch,
} from "./dashboard-parsers";

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

function imageForm(entries: Record<string, string>, file?: File): FormData {
  const data = form(entries);
  if (file) data.set("image", file);
  return data;
}

function testFile(bytes: readonly number[], name: string, type: string): File {
  const file = new File([new Uint8Array(bytes)], name, { type });
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => new Uint8Array(bytes).buffer,
  });
  return file;
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

  test("rejects non-numeric economy values and reports the field", () => {
    expect(parseDailyEconomyPatch(form({ reward: "lots" }))).toEqual({
      ok: false,
      error: "reward must be numeric.",
      field: "reward",
    });
  });

  test("rejects out-of-range tax rates and reports the field", () => {
    expect(parseTaxEconomyPatch(form({ rate: "2" }))).toEqual({
      ok: false,
      error: "rate must be between 0 and 1.",
      field: "rate",
    });
  });

  test("reports the offending field for nested numeric failures", () => {
    // cooldownHours is the second field parsed; the failure must still name it
    // so the dashboard can place the error inline rather than on the first field.
    expect(parseDailyEconomyPatch(form({ reward: "5", cooldownHours: "0" }))).toEqual({
      ok: false,
      error: "cooldownHours must be at least 1.",
      field: "cooldownHours",
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

  test("parses image detection settings", () => {
    expect(
      parseAutomodPatch(
        form({ enabled: "on", reportChannelId: "reports", tolerance: "strict" }),
        "imageDetection",
      ),
    ).toEqual({
      ok: true,
      value: {
        imageDetection: {
          enabled: true,
          reportChannelId: "reports",
          tolerance: "strict",
        },
      },
    });
  });

  test("parses plain text automod rules", () => {
    const parsed = parseAutomodPatch(
      form({
        rules: JSON.stringify([
          {
            id: "badword",
            enabled: true,
            phrases: ["badword", "worse word"],
            action: "timeout",
            timeoutSeconds: 900,
          },
        ]),
      }),
      "textRules",
    );

    expect(parsed).toEqual({
      ok: true,
      value: {
        textRules: [
          {
            id: "badword",
            enabled: true,
            phrases: ["badword", "worse word"],
            action: "timeout",
            timeoutSeconds: 900,
          },
        ],
      },
    });
  });

  test("rejects text automod rules without phrases", () => {
    expect(
      parseAutomodPatch(
        form({
          rules: JSON.stringify([
            {
              id: "badword",
              enabled: true,
              phrases: [],
              action: "delete",
              timeoutSeconds: 300,
            },
          ]),
        }),
        "textRules",
      ),
    ).toEqual({ ok: false, error: "Each text rule needs an id, phrases, action, and timeout." });
  });

  test("rejects invalid image detection tolerance", () => {
    expect(parseAutomodPatch(form({ tolerance: "wild" }), "imageDetection")).toEqual({
      ok: false,
      error: "tolerance must be strict, balanced, or loose.",
    });
  });

  test("parses banned image uploads with required reason", async () => {
    const parsed = await parseBannedImageUpload(
      imageForm(
        { reason: "blocked", label: "bad image" },
        testFile([1, 2, 3], "bad.png", "image/png"),
      ),
    );

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value).toMatchObject({
        filename: "bad.png",
        contentType: "image/png",
        reason: "blocked",
        label: "bad image",
      });
      expect([...parsed.value.bytes]).toEqual([1, 2, 3]);
    }
  });

  test("rejects banned image uploads without a reason", async () => {
    expect(
      await parseBannedImageUpload(imageForm({}, testFile([1], "bad.png", "image/png"))),
    ).toEqual({ ok: false, error: "reason required." });
  });

  test("parses non-mutating banned image tests", async () => {
    const parsed = await parseBannedImageTest(
      imageForm({}, testFile([1], "probe.webp", "image/webp")),
    );

    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.filename).toBe("probe.webp");
  });
});
