import { describe, expect, it, mock } from "bun:test";
import sharp from "sharp";
import type { BannedImageRecord } from "./bannedImages";

const docs: unknown[] = [];
let inserted: unknown = null;

mock.module("@/core/db", () => ({
  getDb: async () => ({
    collection: () => ({
      find: () => ({
        sort: () => ({
          toArray: async () => docs,
        }),
      }),
      insertOne: async (doc: unknown) => {
        inserted = doc;
      },
      findOneAndUpdate: async () => null,
    }),
  }),
}));

function activeRecord(overrides: Record<string, unknown> = {}): BannedImageRecord {
  return {
    _id: "guild-1:img-1",
    guildId: "guild-1",
    status: "active" as const,
    reason: "known scam image",
    label: "scam",
    sourceUrl: "https://cdn.example/image.png",
    sourceContentType: "image/png",
    sourceFilename: "image.png",
    hashes: {
      average: "ffff0000ffff0000",
      difference: "0000ffff0000ffff",
      verticalDifference: "f0f0f0f00f0f0f0f",
    },
    addedBy: "mod-1",
    addedAt: new Date("2026-05-21T12:00:00.000Z"),
    removedBy: null,
    removedAt: null,
    ...overrides,
  } as BannedImageRecord;
}

async function tinyPng(): Promise<Buffer> {
  return sharp({
    create: {
      width: 4,
      height: 4,
      channels: 3,
      background: { r: 80, g: 120, b: 180 },
    },
  })
    .png()
    .toBuffer();
}

describe("banned image detection", () => {
  it("finds a balanced near-duplicate match", async () => {
    const { findBannedImageMatch } = await import("./bannedImages");

    const match = findBannedImageMatch(
      {
        average: "ffff0000ffff0001",
        difference: "0000ffff0000ffff",
        verticalDifference: "f0f0f0f00f0f0f0f",
      },
      [activeRecord()],
      "balanced",
    );

    expect(match?.record._id).toBe("guild-1:img-1");
    expect(match?.distance.total).toBe(1);
  });

  it("does not emit signals when image detection is disabled", async () => {
    const { detectBannedImageSignals } = await import("./bannedImages");

    const signals = await detectBannedImageSignals(
      {
        guild: { id: "guild-1" },
        attachments: new Map(),
      } as never,
      { imageDetection: { enabled: false, reportChannelId: null, tolerance: "balanced" } } as never,
    );

    expect(signals).toEqual([]);
  });

  it("emits one signal for a matching image attachment", async () => {
    docs.length = 0;
    docs.push(activeRecord());
    const { detectBannedImageSignals } = await import("./bannedImages");
    const { hashImageBuffer } = await import("./imageHash");
    const bytes = await tinyPng();
    const hashes = await hashImageBuffer(bytes);
    docs[0] = activeRecord({ hashes });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(new Uint8Array(bytes), {
        headers: { "content-length": String(bytes.byteLength) },
      })) as unknown as typeof fetch;

    try {
      const signals = await detectBannedImageSignals(
        {
          guild: { id: "guild-1" },
          author: { id: "user-1" },
          channelId: "channel-1",
          id: "message-1",
          attachments: new Map([
            [
              "attachment-1",
              {
                id: "attachment-1",
                url: "https://cdn.example/current.png",
                contentType: "image/png",
                name: "current.png",
                size: bytes.byteLength,
              },
            ],
          ]),
        } as never,
        {
          imageDetection: { enabled: true, reportChannelId: null, tolerance: "balanced" },
        } as never,
      );

      expect(signals).toHaveLength(1);
      expect(signals[0]?.detectorId).toBe("bannedImage");
      expect(signals[0]?.recommendedAction).toBe("delete");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("stores moderator metadata when adding a banned image", async () => {
    inserted = null;
    const { addBannedImage, displayBannedImageId } = await import("./bannedImages");

    const record = await addBannedImage({
      guildId: "guild-1",
      actorId: "mod-1",
      reason: "known scam image",
      label: "scam",
      sourceUrl: "https://cdn.example/image.png",
      sourceContentType: "image/png",
      sourceFilename: "image.png",
      hashes: {
        average: "ffff0000ffff0000",
        difference: "0000ffff0000ffff",
        verticalDifference: "f0f0f0f00f0f0f0f",
      },
    });

    expect(displayBannedImageId(record)).not.toContain("guild-1:");
    expect(inserted).toMatchObject({
      guildId: "guild-1",
      status: "active",
      reason: "known scam image",
      label: "scam",
      sourceUrl: "https://cdn.example/image.png",
      addedBy: "mod-1",
    });
  });
});
