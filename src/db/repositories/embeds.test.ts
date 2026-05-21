import { describe, expect, spyOn, test } from "bun:test";
import type { EmbedConfig } from "@/db/schemas/embed-config";
import { MongoStore } from "@/db/store";
import { patchEmbedConfig } from "./embeds";

function embedConfig(id: string): EmbedConfig {
  const [guildId, name] = id.split(":");
  return {
    _id: id,
    guildId,
    name,
    createdBy: "tester",
    embedTitle: "Test",
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
    stickyMessageId: null,
    stickyLastResendAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };
}

describe("embeds repository", () => {
  test("patchEmbedConfig updates existing docs without building defaults", async () => {
    const id = "test-guild:status";
    const originalError = console.error;
    const errors: unknown[][] = [];
    const collectionSpy = spyOn(MongoStore.prototype, "collection").mockImplementation(async () => {
      return {
        findOneAndUpdate: async () => ({ ...embedConfig(id), stickyMessageId: "message-1" }),
      } as never;
    });

    try {
      console.error = (...args: unknown[]) => {
        errors.push(args);
      };
      const patchRes = await patchEmbedConfig(id, { stickyMessageId: "message-1" });
      expect(patchRes.isOk()).toBe(true);
      expect(patchRes.unwrap().stickyMessageId).toBe("message-1");
    } finally {
      console.error = originalError;
      collectionSpy.mockRestore();
    }

    expect(errors).toEqual([]);
  });
});
