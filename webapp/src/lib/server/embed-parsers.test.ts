import { describe, expect, test } from "bun:test";
import { blankEmbedDraft, parseEmbedDraft } from "./embed-parsers";

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

describe("parseEmbedDraft", () => {
  test("shapes a full draft, converting hex color and JSON fields", () => {
    const parsed = parseEmbedDraft(
      form({
        title: "hi",
        description: "body",
        color: "#5865f2",
        fields: JSON.stringify([{ name: "a", value: "b", inline: true }]),
        channelId: "chan-1",
        scheduleInterval: "24",
        sticky: "on",
        scriptEnabled: "on",
        script: "x",
      }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.embedTitle).toBe("hi");
    expect(parsed.value.embedColor).toBe(0x5865f2);
    expect(parsed.value.embedFields).toEqual([{ name: "a", value: "b", inline: true }]);
    expect(parsed.value.channelId).toBe("chan-1");
    expect(parsed.value.scheduleEnabled).toBe(true);
    expect(parsed.value.scheduleIntervalHours).toBe(24);
    expect(parsed.value.stickyEnabled).toBe(true);
    expect(parsed.value.scriptEnabled).toBe(true);
  });

  test("drops fully-empty field rows but keeps partial ones", () => {
    const parsed = parseEmbedDraft(
      form({
        fields: JSON.stringify([
          { name: "", value: "", inline: false },
          { name: "kept", value: "", inline: false },
        ]),
      }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.embedFields).toEqual([{ name: "kept", value: "", inline: false }]);
  });

  test("treats 'off' schedule as disabled", () => {
    const parsed = parseEmbedDraft(form({ scheduleInterval: "off" }));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.scheduleEnabled).toBe(false);
    expect(parsed.value.scheduleIntervalHours).toBeNull();
  });

  test("rejects an invalid color", () => {
    const parsed = parseEmbedDraft(form({ color: "nope" }));
    expect(parsed.ok).toBe(false);
  });

  test("rejects malformed fields JSON", () => {
    const parsed = parseEmbedDraft(form({ fields: "{not json" }));
    expect(parsed.ok).toBe(false);
  });

  test("blankEmbedDraft has no content", () => {
    const blank = blankEmbedDraft();
    expect(blank.embedTitle).toBeNull();
    expect(blank.embedFields).toEqual([]);
    expect(blank.scheduleEnabled).toBe(false);
    expect(blank.stickyEnabled).toBe(false);
  });
});
