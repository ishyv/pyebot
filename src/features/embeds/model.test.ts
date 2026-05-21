import { describe, expect, it } from "bun:test";
import type { EmbedConfig } from "@/db/schemas/embed-config";
import {
  configFromDraft,
  createBlankEmbedDraft,
  draftFromConfig,
  parseEmbedColor,
  parseEmbedName,
  parseOptionalUrl,
  parseScheduleValue,
} from "./model";

function config(overrides: Partial<EmbedConfig> = {}): EmbedConfig {
  return {
    _id: "guild-1:status",
    guildId: "guild-1",
    name: "status",
    createdBy: "creator-1",
    embedTitle: "Old",
    embedDescription: null,
    embedColor: null,
    embedUrl: null,
    embedThumbnail: null,
    embedImage: null,
    embedAuthorName: null,
    embedAuthorIconUrl: null,
    embedAuthorUrl: null,
    embedFooterText: null,
    embedFooterIconUrl: null,
    embedFields: [],
    script: null,
    scriptEnabled: false,
    channelId: "channel-1",
    scheduleEnabled: false,
    scheduleIntervalHours: null,
    scheduledNextSendAt: null,
    scheduledLastSentAt: null,
    stickyEnabled: true,
    stickyMessageId: "sticky-1",
    stickyLastResendAt: new Date("2026-01-01T00:00:00Z"),
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-02T00:00:00Z"),
    ...overrides,
  };
}

describe("embed model helpers", () => {
  it("parseEmbedName normalizes Discord input into the persisted key segment", () => {
    expect(parseEmbedName("  Server Status!! ")).toBe("serverstatus");
    expect(parseEmbedName("Offer_Review-1")).toBe("offer_review-1");
    expect(parseEmbedName("!!!")).toBeNull();
  });

  it("parseEmbedColor accepts six-digit hex with or without #", () => {
    expect(parseEmbedColor("#5865F2")).toBe(0x5865f2);
    expect(parseEmbedColor("ed4245")).toBe(0xed4245);
    expect(parseEmbedColor("")).toBeNull();
    expect(parseEmbedColor("#xyzxyz")).toBeNull();
  });

  it("parseOptionalUrl returns null for empty or invalid URL input", () => {
    expect(parseOptionalUrl(" https://example.com/a ")).toBe("https://example.com/a");
    expect(parseOptionalUrl("")).toBeNull();
    expect(parseOptionalUrl("not a url")).toBeNull();
  });

  it("parseScheduleValue narrows select values to the supported interval set", () => {
    expect(parseScheduleValue("off")).toEqual({
      scheduleEnabled: false,
      scheduleIntervalHours: null,
    });
    expect(parseScheduleValue("24")).toEqual({ scheduleEnabled: true, scheduleIntervalHours: 24 });
    expect(parseScheduleValue("999")).toBeNull();
  });

  it("draftFromConfig and createBlankEmbedDraft keep only editable fields", () => {
    const blank = createBlankEmbedDraft();
    expect(blank.embedTitle).toBeNull();
    expect(blank.stickyEnabled).toBe(false);

    const draft = draftFromConfig(config({ embedTitle: "Title", stickyMessageId: "runtime-id" }));
    expect(draft.embedTitle).toBe("Title");
    expect(draft.stickyEnabled).toBe(true);
    expect("stickyMessageId" in draft).toBe(false);
  });

  it("configFromDraft preserves edit metadata and sticky state when channel stays the same", () => {
    const previous = config();
    const draft = draftFromConfig(previous);
    draft.embedTitle = "New";
    const now = new Date("2026-02-01T00:00:00Z");

    const next = configFromDraft(
      { guildId: "guild-1", ownerId: "editor-1", embedName: "status", draft },
      previous,
      now,
    );

    expect(next.embedTitle).toBe("New");
    expect(next.createdAt).toEqual(previous.createdAt);
    expect(next.createdBy).toBe("creator-1");
    expect(next.stickyMessageId).toBe("sticky-1");
    expect(next.stickyLastResendAt).toEqual(previous.stickyLastResendAt);
    expect(next.updatedAt).toEqual(now);
  });

  it("configFromDraft clears sticky runtime state when sticky is disabled or channel changes", () => {
    const previous = config();
    const draft = draftFromConfig(previous);
    draft.channelId = "channel-2";

    const next = configFromDraft(
      { guildId: "guild-1", ownerId: "editor-1", embedName: "status", draft },
      previous,
      new Date("2026-02-01T00:00:00Z"),
    );

    expect(next.stickyMessageId).toBeNull();
    expect(next.stickyLastResendAt).toBeNull();

    draft.channelId = "channel-1";
    draft.stickyEnabled = false;
    const disabled = configFromDraft(
      { guildId: "guild-1", ownerId: "editor-1", embedName: "status", draft },
      previous,
      new Date("2026-02-01T00:00:00Z"),
    );
    expect(disabled.stickyMessageId).toBeNull();
  });
});
