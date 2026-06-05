import { describe, expect, it } from "bun:test";
import sharp from "sharp";
import { BannedImages, type BannedImageValue } from "@/components/banned-image";
import type { EntityContext } from "@/framework/entity-context";
import {
  addBannedImage,
  type BannedImageRecord,
  detectBannedImageSignals,
  displayBannedImageId,
  findBannedImageMatch,
} from "./bannedImages";

/** In-memory entity context backing the `BannedImages` map, keyed by guild id. */
function makeEntities(seed: Record<string, Record<string, BannedImageValue>> = {}): {
  entities: EntityContext;
  read: (guildId: string) => Record<string, BannedImageValue>;
} {
  const guilds = new Map<string, Record<string, BannedImageValue>>(Object.entries(seed));
  const entities = {
    of(_kind: unknown, id: string) {
      return {
        async get(component: unknown) {
          if (component !== BannedImages) throw new Error("unexpected component in test ctx");
          return { records: guilds.get(id) ?? {} };
        },
        async update(component: unknown, patch: unknown) {
          if (component !== BannedImages) throw new Error("unexpected component in test ctx");
          const current = { records: guilds.get(id) ?? {} };
          const partial = typeof patch === "function" ? patch(current) : patch;
          guilds.set(id, (partial as { records: Record<string, BannedImageValue> }).records);
        },
      };
    },
    select() {
      throw new Error("select not used");
    },
    transaction() {
      throw new Error("transaction not used");
    },
  } as unknown as EntityContext;
  return { entities, read: (guildId) => guilds.get(guildId) ?? {} };
}

function imageValue(overrides: Partial<BannedImageValue> = {}): BannedImageValue {
  return {
    guildId: "guild-1",
    status: "active",
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
  };
}

function record(id: string, overrides: Partial<BannedImageValue> = {}): BannedImageRecord {
  return { ...imageValue(overrides), id };
}

async function tinyPng(): Promise<Buffer> {
  return sharp({
    create: { width: 4, height: 4, channels: 3, background: { r: 80, g: 120, b: 180 } },
  })
    .png()
    .toBuffer();
}

describe("banned image detection", () => {
  it("finds a balanced near-duplicate match", () => {
    const match = findBannedImageMatch(
      {
        average: "ffff0000ffff0001",
        difference: "0000ffff0000ffff",
        verticalDifference: "f0f0f0f00f0f0f0f",
      },
      [record("img-1")],
      "balanced",
    );

    expect(match?.record.id).toBe("img-1");
    expect(match?.distance.total).toBe(1);
  });

  it("does not emit signals when image detection is disabled", async () => {
    const { entities } = makeEntities();
    const signals = await detectBannedImageSignals(
      entities,
      { guild: { id: "guild-1" }, attachments: new Map() } as never,
      { imageDetection: { enabled: false, reportChannelId: null, tolerance: "balanced" } } as never,
    );

    expect(signals).toEqual([]);
  });

  it("emits one signal for a matching image attachment", async () => {
    const bytes = await tinyPng();
    const { hashImageBuffer } = await import("./imageHash");
    const hashes = await hashImageBuffer(bytes);
    const { entities } = makeEntities({ "guild-1": { "img-1": imageValue({ hashes }) } });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(new Uint8Array(bytes), {
        headers: { "content-length": String(bytes.byteLength) },
      })) as unknown as typeof fetch;

    try {
      const signals = await detectBannedImageSignals(
        entities,
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
    const { entities, read } = makeEntities();

    const added = await addBannedImage(entities, {
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

    expect(displayBannedImageId(added)).not.toContain("guild-1:");
    expect(read("guild-1")[added.id]).toMatchObject({
      guildId: "guild-1",
      status: "active",
      reason: "known scam image",
      label: "scam",
      sourceUrl: "https://cdn.example/image.png",
      addedBy: "mod-1",
    });
  });
});
