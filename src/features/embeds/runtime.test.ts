import { describe, expect, it } from "bun:test";
import { ErrResult, OkResult, type Result } from "@/core/result";
import type { EmbedConfig } from "@/db/schemas/embed-config";
import { createScheduledEmbedRuntime, createStickyEmbedRuntime } from "./runtime";

function config(overrides: Partial<EmbedConfig> = {}): EmbedConfig {
  return {
    _id: "guild-1:status",
    guildId: "guild-1",
    name: "status",
    createdBy: "creator-1",
    embedTitle: "Title",
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
    scheduleEnabled: true,
    scheduleIntervalHours: 24,
    scheduledNextSendAt: new Date("2026-01-01T00:00:00Z"),
    scheduledLastSentAt: null,
    stickyEnabled: true,
    stickyMessageId: "old-sticky",
    stickyLastResendAt: new Date("2026-01-01T00:00:00Z"),
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
    ...overrides,
  };
}

function message(overrides: Record<string, unknown> = {}) {
  const deleted: string[] = [];
  return {
    author: { bot: false },
    guildId: "guild-1",
    guild: { id: "guild-1", name: "Guild", memberCount: 5 },
    channelId: "channel-1",
    channel: {
      id: "channel-1",
      isTextBased: () => true,
      messages: {
        delete: async (id: string) => {
          deleted.push(id);
        },
      },
    },
    deleted,
    ...overrides,
  };
}

describe("sticky embed runtime", () => {
  it("ignores bot messages", async () => {
    let sends = 0;
    const runtime = createStickyEmbedRuntime({
      findStickyForChannel: async () => OkResult(config()),
      getEmbedConfigById: async () => OkResult(config()),
      patchEmbedConfig: async () => OkResult(config()),
      sendEmbed: async () => {
        sends += 1;
        return { id: "new-sticky" };
      },
      log: { warn() {}, error() {} },
      now: () => 1_800_000_000_000,
    });

    await runtime.handleMessage(message({ author: { bot: true } }) as never);

    expect(sends).toBe(0);
  });

  it("posts sticky, deletes the previous message best-effort, and persists the new id", async () => {
    const patches: Partial<EmbedConfig>[] = [];
    const runtime = createStickyEmbedRuntime({
      findStickyForChannel: async () => OkResult(config()),
      getEmbedConfigById: async () => OkResult(config()),
      patchEmbedConfig: async (_id, patch) => {
        patches.push(patch);
        return OkResult(config(patch));
      },
      sendEmbed: async () => ({ id: "new-sticky" }),
      log: { warn() {}, error() {} },
      now: () => 1_800_000_000_000,
    });
    const msg = message();

    await runtime.handleMessage(msg as never);

    expect(msg.deleted).toEqual(["old-sticky"]);
    expect(patches[0].stickyMessageId).toBe("new-sticky");
    expect(patches[0].stickyLastResendAt).toBeInstanceOf(Date);
  });

  it("continues reposting when deleting the old sticky message fails", async () => {
    let sends = 0;
    const runtime = createStickyEmbedRuntime({
      findStickyForChannel: async () => OkResult(config()),
      getEmbedConfigById: async () => OkResult(config()),
      patchEmbedConfig: async () => OkResult(config()),
      sendEmbed: async () => {
        sends += 1;
        return { id: "new-sticky" };
      },
      log: { warn() {}, error() {} },
      now: () => 1_800_000_000_000,
    });
    const msg = message({
      channel: {
        id: "channel-1",
        isTextBased: () => true,
        messages: { delete: async () => Promise.reject(new Error("missing")) },
      },
    });

    await runtime.handleMessage(msg as never);

    expect(sends).toBe(1);
  });

  it("does not cache a false negative when sticky lookup fails", async () => {
    let lookups = 0;
    const runtime = createStickyEmbedRuntime({
      findStickyForChannel: async () => {
        lookups += 1;
        return ErrResult(new Error("db down")) as Result<EmbedConfig | null>;
      },
      getEmbedConfigById: async () => OkResult(null),
      patchEmbedConfig: async () => OkResult(config()),
      sendEmbed: async () => ({ id: "new-sticky" }),
      log: { warn() {}, error() {} },
      now: () => 1_800_000_000_000,
    });

    await runtime.handleMessage(message() as never);
    await runtime.handleMessage(message() as never);

    expect(lookups).toBe(2);
  });

  it("evicts cache when persisting the new sticky message id fails", async () => {
    let lookups = 0;
    const runtime = createStickyEmbedRuntime({
      findStickyForChannel: async () => {
        lookups += 1;
        return OkResult(config());
      },
      getEmbedConfigById: async () => OkResult(config()),
      patchEmbedConfig: async () => ErrResult(new Error("write failed")) as Result<EmbedConfig>,
      sendEmbed: async () => ({ id: "new-sticky" }),
      log: { warn() {}, error() {} },
      now: () => 1_800_000_000_000,
    });

    await runtime.handleMessage(message() as never);
    await runtime.handleMessage(message() as never);

    expect(lookups).toBe(2);
  });

  it("debounces immediate reposts", async () => {
    let sends = 0;
    const runtime = createStickyEmbedRuntime({
      findStickyForChannel: async () =>
        OkResult(config({ stickyLastResendAt: new Date(1_800_000_000_000 - 100) })),
      getEmbedConfigById: async () => OkResult(config()),
      patchEmbedConfig: async () => OkResult(config()),
      sendEmbed: async () => {
        sends += 1;
        return { id: "new-sticky" };
      },
      log: { warn() {}, error() {} },
      now: () => 1_800_000_000_000,
    });

    await runtime.handleMessage(message() as never);

    expect(sends).toBe(0);
  });

  it("invalidates cache by guild and channel", async () => {
    let lookups = 0;
    const runtime = createStickyEmbedRuntime({
      findStickyForChannel: async () => {
        lookups += 1;
        return OkResult(null);
      },
      getEmbedConfigById: async () => OkResult(null),
      patchEmbedConfig: async () => OkResult(config()),
      sendEmbed: async () => ({ id: "new-sticky" }),
      log: { warn() {}, error() {} },
      now: () => 1_800_000_000_000,
    });

    await runtime.handleMessage(message() as never);
    await runtime.handleMessage(message() as never);
    runtime.invalidate("guild-1", "channel-1");
    await runtime.handleMessage(message() as never);

    expect(lookups).toBe(2);
  });
});

describe("scheduled embed runtime", () => {
  it("sends due embeds and advances schedule state", async () => {
    const patches: Partial<EmbedConfig>[] = [];
    const channel = { id: "channel-1", isTextBased: () => true };
    const guild = { id: "guild-1", channels: { fetch: async () => channel } };
    const client = { guilds: { fetch: async () => guild } };
    const runtime = createScheduledEmbedRuntime({
      findDueScheduled: async () => OkResult([config({ scheduleIntervalHours: 6 })]),
      patchEmbedConfig: async (_id, patch) => {
        patches.push(patch);
        return OkResult(config(patch));
      },
      sendEmbed: async () => ({ id: "sent-1" }),
      log: { warn() {}, error() {} },
      now: () => new Date("2026-01-01T00:00:00Z"),
    });

    await runtime.runSweep(client as never);

    expect(patches).toHaveLength(1);
    expect(patches[0].scheduledLastSentAt).toEqual(new Date("2026-01-01T00:00:00Z"));
    expect(patches[0].scheduledNextSendAt).toEqual(new Date("2026-01-01T06:00:00Z"));
    expect(patches[0].stickyMessageId).toBe("sent-1");
  });

  it("skips scheduled embeds when guild or channel cannot be resolved", async () => {
    let sends = 0;
    const runtime = createScheduledEmbedRuntime({
      findDueScheduled: async () => OkResult([config({ _id: "guild-1:a" })]),
      patchEmbedConfig: async () => OkResult(config()),
      sendEmbed: async () => {
        sends += 1;
        return { id: "sent-1" };
      },
      log: { warn() {}, error() {} },
      now: () => new Date("2026-01-01T00:00:00Z"),
    });

    await runtime.runSweep({ guilds: { fetch: async () => null } } as never);

    expect(sends).toBe(0);
  });

  it("continues sweeping when one scheduled embed fails", async () => {
    const patches: string[] = [];
    const channel = { id: "channel-1", isTextBased: () => true };
    const guild = { id: "guild-1", channels: { fetch: async () => channel } };
    const client = { guilds: { fetch: async () => guild } };
    const runtime = createScheduledEmbedRuntime({
      findDueScheduled: async () =>
        OkResult([config({ _id: "guild-1:a" }), config({ _id: "guild-1:b" })]),
      patchEmbedConfig: async (id, patch) => {
        patches.push(id);
        return OkResult(config({ _id: id, ...patch }));
      },
      sendEmbed: async (cfg) => {
        if (cfg._id.endsWith(":a")) throw new Error("send failed");
        return { id: "sent-b" };
      },
      log: { warn() {}, error() {} },
      now: () => new Date("2026-01-01T00:00:00Z"),
    });

    await runtime.runSweep(client as never);

    expect(patches).toEqual(["guild-1:b"]);
  });
});
