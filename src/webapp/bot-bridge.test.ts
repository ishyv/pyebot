import { describe, expect, it, mock } from "bun:test";
import sharp from "sharp";
import { bus } from "@/core/bus";
import { OkResult } from "@/core/result";

const collectionUpdates: Array<{
  collection: string;
  filter: unknown;
  update: Record<string, unknown>;
  options: unknown;
}> = [];

const guildWrites: Array<{ guildId: string; paths: Record<string, unknown>; options: unknown }> =
  [];

const moderationCalls: Array<{ type: string; args: unknown[] }> = [];
const embedConfigs = new Map<string, Record<string, unknown>>();
const sentEmbeds: Array<{ args: unknown[] }> = [];
const activeBridgeBannedImages: unknown[] = [];
let mockFeatureCatalog: Array<Record<string, unknown>> = [{ id: "economy", defaultEnabled: true }];

// Banned-image storage is the entity model now: an in-memory guild→records map
// behind a mocked headless entity context.
const bridgeImages = new Map<string, Record<string, Record<string, unknown>>>();

mock.module("@/framework/entity-context", () => ({
  headlessEntityContext: async () => ({
    of(_kind: unknown, id: string) {
      return {
        async get() {
          return { records: bridgeImages.get(id) ?? {} };
        },
        async update(_component: unknown, patch: unknown) {
          const current = { records: bridgeImages.get(id) ?? {} };
          const partial = typeof patch === "function" ? patch(current) : patch;
          bridgeImages.set(
            id,
            (partial as { records: Record<string, Record<string, unknown>> }).records,
          );
        },
      };
    },
  }),
}));

function matchesFilter(doc: Record<string, unknown>, filter: unknown): boolean {
  if (!filter || typeof filter !== "object") return true;
  return Object.entries(filter as Record<string, unknown>).every(
    ([key, value]) => doc[key] === value,
  );
}

function collectionDocs(name: string, filter?: unknown): Record<string, unknown>[] {
  const docs =
    name === "banned_images"
      ? (activeBridgeBannedImages as Record<string, unknown>[])
      : name === "embed_configs"
        ? [...embedConfigs.values()]
        : [];
  return docs.filter((doc) => matchesFilter(doc, filter));
}

function samplePng(): Promise<Buffer> {
  return sharp({
    create: {
      width: 8,
      height: 8,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  })
    .png()
    .toBuffer();
}

mock.module("@/core/db", () => ({
  getDb: async () => ({
    collection: (name: string) => ({
      insertOne: async (doc: unknown) => {
        if (name === "banned_images") activeBridgeBannedImages.push(doc);
        return { insertedId: (doc as { _id?: string })._id };
      },
      replaceOne: async (filter: unknown, doc: Record<string, unknown>) => {
        if (name === "embed_configs") {
          embedConfigs.set(String(doc._id), doc);
        }
        collectionUpdates.push({
          collection: name,
          filter,
          update: { $replace: doc },
          options: {},
        });
        return { matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
      },
      updateOne: async (filter: unknown, update: Record<string, unknown>, options: unknown) => {
        collectionUpdates.push({ collection: name, filter, update, options });
        return { matchedCount: 1, modifiedCount: 1 };
      },
      findOneAndUpdate: async (
        filter: unknown,
        update: Record<string, unknown>,
        options: unknown,
      ) => {
        collectionUpdates.push({ collection: name, filter, update, options });
        if (name === "banned_images") {
          const criteria = filter as { _id?: string; guildId?: string };
          const existing = activeBridgeBannedImages.find(
            (entry) =>
              (entry as { _id?: string; guildId?: string })._id === criteria._id &&
              (entry as { _id?: string; guildId?: string }).guildId === criteria.guildId,
          ) as Record<string, unknown> | undefined;
          if (!existing) return null;
          Object.assign(existing, (update.$set as Record<string, unknown> | undefined) ?? {});
          return existing;
        }
        if (name === "embed_configs") {
          const criteria = filter as { _id?: string };
          const existing = criteria._id ? embedConfigs.get(criteria._id) : undefined;
          if (!existing) return null;
          Object.assign(existing, (update.$set as Record<string, unknown> | undefined) ?? {});
          return existing;
        }
        return { _id: "guild-1", daily: {}, work: {}, sectors: {} };
      },
      find: (filter?: unknown) => ({
        sort: () => ({
          limit: () => ({
            toArray: async () => [],
          }),
          toArray: async () => collectionDocs(name, filter),
        }),
        limit: () => ({
          toArray: async () => [],
        }),
        toArray: async () => collectionDocs(name, filter),
      }),
      findOne: async (filter?: unknown) => collectionDocs(name, filter)[0] ?? null,
      deleteOne: async (filter: unknown) => {
        if (name === "embed_configs") {
          const criteria = filter as { _id?: string };
          const deleted = criteria._id ? embedConfigs.delete(criteria._id) : false;
          return { deletedCount: deleted ? 1 : 0 };
        }
        return { deletedCount: 0 };
      },
    }),
  }),
}));

mock.module("@/db/repositories/guilds", () => ({
  guildStore: {},
  ensureGuild: async (guildId: string) =>
    OkResult({
      _id: guildId,
      channels: { core: {} },
      moderation: { quarantine: { enabled: true, roleId: "quarantine-role" } },
      automod: { linkSpam: {}, mentionSpam: {}, imageDetection: { tolerance: "balanced" } },
      roles: {},
    }),
  getGuild: async (guildId: string) =>
    OkResult({
      _id: guildId,
      channels: { core: {} },
      moderation: { quarantine: { enabled: true, roleId: "quarantine-role" } },
      automod: { linkSpam: {}, mentionSpam: {}, imageDetection: { tolerance: "balanced" } },
      roles: {},
    }),
  patchGuild: async (guildId: string, patch: Record<string, unknown>) =>
    OkResult({ _id: guildId, ...patch }),
  updateGuildPaths: async (guildId: string, paths: Record<string, unknown>, options: unknown) => {
    guildWrites.push({ guildId, paths, options });
    return OkResult(undefined);
  },
}));

mock.module("@/components/guild-features", () => ({
  GuildFeatures: {
    collection: "guild_features",
    schema: { safeParse: () => ({ success: true, data: { overrides: {} } }) },
  },
  applyFeatureOverride: (
    current: { overrides?: Record<string, boolean> },
    featureId: string,
    enabled: boolean,
  ) => ({ overrides: { ...(current.overrides ?? {}), [featureId]: enabled } }),
  getGuildFeatures: async () => OkResult({ overrides: {} }),
  resolveFeatureEnabled: (
    feature: { id: string; defaultEnabled?: boolean },
    overrides?: Readonly<Record<string, boolean>> | null,
  ) => overrides?.[feature.id] ?? feature.defaultEnabled !== false,
  setGuildFeatureOverride: async () => OkResult({ overrides: {} }),
  setGuildFeatureOverrides: async () => OkResult({ overrides: {} }),
}));

mock.module("@/core/featureCatalog", () => ({
  setFeatureCatalog: (
    features: readonly { descriptor: Record<string, unknown> }[],
    configs: Record<string, unknown> = {},
  ) => {
    mockFeatureCatalog = features.map((feature) => {
      const config = configs[String(feature.descriptor.id)];
      return config ? { ...feature.descriptor, config } : feature.descriptor;
    });
  },
  listFeatureCatalog: () => mockFeatureCatalog,
  listConfigurableFeatures: () =>
    mockFeatureCatalog.filter((feature) => feature.config !== undefined),
}));

mock.module("@/features/moderation/service", () => ({
  DURATION_MAP: {
    "1h": 60 * 60 * 1000,
    "1d": 24 * 60 * 60 * 1000,
  },
  TEMP_BAN_DURATION_CHOICES: [],
  recordAutomodSystemCase: async (...args: unknown[]) => {
    moderationCalls.push({ type: "recordAutomodSystemCase", args });
    return OkResult({ caseId: 1 });
  },
  getCases: async (...args: unknown[]) => {
    moderationCalls.push({ type: "getCases", args });
    return OkResult([]);
  },
  getCaseById: async (...args: unknown[]) => {
    moderationCalls.push({ type: "getCaseById", args });
    return OkResult(null);
  },
  ban: async (...args: unknown[]) => {
    moderationCalls.push({ type: "ban", args });
    return OkResult({ caseId: 1 });
  },
  kick: async (...args: unknown[]) => {
    moderationCalls.push({ type: "kick", args });
    return OkResult({ caseId: 1 });
  },
  mute: async (...args: unknown[]) => {
    moderationCalls.push({ type: "timeout", args });
    return OkResult({ caseId: 1 });
  },
  warn: async (...args: unknown[]) => {
    moderationCalls.push({ type: "warn", args });
    return OkResult({ caseId: 1 });
  },
  restrict: async (...args: unknown[]) => {
    moderationCalls.push({ type: "restrict", args });
    return OkResult({ caseId: 1 });
  },
  unban: async (...args: unknown[]) => {
    moderationCalls.push({ type: "unban", args });
    return OkResult({ caseId: 1 });
  },
  pardon: async (...args: unknown[]) => {
    moderationCalls.push({ type: "pardon", args });
    return OkResult({ caseId: 1 });
  },
  editCase: async (...args: unknown[]) => {
    moderationCalls.push({ type: "editCase", args });
    return OkResult(undefined);
  },
  deleteCase: async (...args: unknown[]) => {
    moderationCalls.push({ type: "deleteCase", args });
    return OkResult(undefined);
  },
  clearWarns: async (...args: unknown[]) => {
    moderationCalls.push({ type: "clearWarns", args });
    return OkResult(undefined);
  },
  removeWarn: async (...args: unknown[]) => {
    moderationCalls.push({ type: "removeWarn", args });
    return OkResult(undefined);
  },
  addNote: async (...args: unknown[]) => {
    moderationCalls.push({ type: "addNote", args });
    return OkResult(undefined);
  },
  deleteNote: async (...args: unknown[]) => {
    moderationCalls.push({ type: "deleteNote", args });
    return OkResult(undefined);
  },
  getNotes: async (...args: unknown[]) => {
    moderationCalls.push({ type: "getNotes", args });
    return OkResult([]);
  },
  quarantine: async (...args: unknown[]) => {
    moderationCalls.push({ type: "quarantine", args });
    return OkResult({ caseId: 1 });
  },
  release: async (...args: unknown[]) => {
    moderationCalls.push({ type: "release", args });
    return OkResult({ caseId: 1 });
  },
}));

function fakeClient(canModerate = true) {
  const guild = {
    id: "guild-1",
    name: "Guild",
    memberCount: 10,
    iconURL: () => null,
    channels: {
      cache: new Map(),
      fetch: async () => ({
        isTextBased: () => true,
        permissionsFor: () => ({ has: () => true }),
        send: async (...args: unknown[]) => {
          sentEmbeds.push({ args });
          return { id: "message-1" };
        },
      }),
    },
    roles: { cache: new Map() },
    members: {
      me: {},
      fetch: async (id: string) => ({
        id,
        user: { id, tag: `${id}#0000` },
        permissions: { has: () => canModerate },
        roles: { cache: new Map(), add: async () => undefined, set: async () => undefined },
        kick: async () => undefined,
        timeout: async () => undefined,
      }),
    },
    bans: {
      create: async () => undefined,
      remove: async () => undefined,
    },
  };

  return {
    user: { id: "bot-1" },
    on: () => undefined,
    guilds: {
      cache: new Map([["guild-1", guild]]),
      fetch: async () => guild,
    },
    users: {
      fetch: async (id: string) => ({ id, tag: `${id}#0000` }),
    },
  };
}

describe("webapp bot bridge", () => {
  it("keeps root bridge composed from focused feature modules", async () => {
    const modules = await Promise.all([
      import("./bot-bridge/guild"),
      import("./bot-bridge/features"),
      import("./bot-bridge/economy"),
      import("./bot-bridge/automod"),
      import("./bot-bridge/banned-images"),
      import("./bot-bridge/moderation"),
      import("./bot-bridge/embeds"),
      import("./bot-bridge/rpg-content"),
    ]);

    for (const module of modules) {
      expect(Object.values(module).some((value) => typeof value === "function")).toBe(true);
    }
  });

  it("exposes representative methods from every bridge cluster", async () => {
    const { createBridgeFromClient } = await import("./bot-bridge");
    const bridge = createBridgeFromClient(fakeClient() as never);

    for (const method of [
      "getChannels",
      "saveChannels",
      "listFeatures",
      "saveEconomy",
      "saveAutomod",
      "listBannedImages",
      "runModerationAction",
      "listEmbeds",
      "getRpgContent",
    ] as const) {
      expect(typeof bridge[method]).toBe("function");
    }
  }, 10_000);

  it("writes economy settings onto the guild economy slice", async () => {
    collectionUpdates.length = 0;
    guildWrites.length = 0;
    const { createBridgeFromClient } = await import("./bot-bridge");
    const bridge = createBridgeFromClient(fakeClient() as never) as never as {
      saveEconomy: (
        guildId: string,
        patch: { daily?: { dailyReward?: number }; work?: { workDailyCap?: number } },
      ) => Promise<{ isOk(): boolean; isErr(): boolean }>;
    };

    const result = await bridge.saveEconomy("guild-1", {
      daily: { dailyReward: 777 },
      work: { workDailyCap: 3 },
    });

    expect(result.isOk()).toBe(true);
    expect(collectionUpdates).toEqual([]);
    expect(guildWrites).toContainEqual({
      guildId: "guild-1",
      paths: {
        "economy.daily.dailyReward": 777,
        "economy.work.workDailyCap": 3,
      },
      options: { upsert: true },
    });
  });

  it("keeps channel writes on the guild config path the bot currently reads", async () => {
    collectionUpdates.length = 0;
    guildWrites.length = 0;
    const { createBridgeFromClient } = await import("./bot-bridge");
    const bridge = createBridgeFromClient(fakeClient() as never) as never as {
      saveChannels: (
        guildId: string,
        slots: Record<string, string | null>,
      ) => Promise<{ isOk(): boolean }>;
    };

    const result = await bridge.saveChannels("guild-1", { modlog: "channel-1", logs: null });

    expect(result.isOk()).toBe(true);
    expect(guildWrites).toEqual([
      {
        guildId: "guild-1",
        paths: {
          "channels.core.modlog": { channelId: "channel-1" },
          "channels.core.logs": null,
        },
        options: { upsert: true },
      },
    ]);
  });

  it("includes the dashboard actor on config-change events", async () => {
    const { createBridgeFromClient } = await import("./bot-bridge");
    const bridge = createBridgeFromClient(fakeClient() as never) as never as {
      events: { on(event: "event", listener: (event: unknown) => void): void };
      saveChannels: (
        guildId: string,
        slots: Record<string, string | null>,
        actorId: string,
      ) => Promise<{ isOk(): boolean }>;
    };
    const seen: unknown[] = [];
    bridge.events.on("event", (event) => seen.push(event));

    const result = await bridge.saveChannels("guild-1", { logs: "channel-1" }, "mod-1");

    expect(result.isOk()).toBe(true);
    expect(seen).toContainEqual({
      type: "config_changed",
      guildId: "guild-1",
      actorId: "mod-1",
      detail: "Updated channels: logs",
      timestamp: expect.any(Number),
    });
  });

  it("adds dashboard-uploaded banned images without storing image bytes", async () => {
    bridgeImages.clear();
    const { createBridgeFromClient } = await import("./bot-bridge");
    const bridge = createBridgeFromClient(fakeClient() as never) as never as {
      addBannedImage: (
        guildId: string,
        input: {
          filename: string;
          contentType: string;
          bytes: Uint8Array;
          reason: string;
          label: string;
        },
        actorId: string,
      ) => Promise<{ isOk(): boolean; unwrap(): { id: string; sourceUrl: string | null } }>;
    };

    const result = await bridge.addBannedImage(
      "guild-1",
      {
        filename: "image.png",
        contentType: "image/png",
        bytes: await samplePng(),
        reason: "blocked",
        label: "bad image",
      },
      "mod-1",
    );

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toMatchObject({ sourceUrl: null });
    const stored = Object.values(bridgeImages.get("guild-1") ?? {});
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      guildId: "guild-1",
      reason: "blocked",
      label: "bad image",
      sourceUrl: null,
      sourceContentType: "image/png",
      sourceFilename: "image.png",
    });
    expect(stored[0]).not.toHaveProperty("bytes");
  });

  it("tests uploaded images against active banned-image records without mutating", async () => {
    const { hashImageBuffer } = await import("@/features/automod/imageHash");
    const png = await samplePng();
    bridgeImages.set("guild-1", {
      "img-1": {
        guildId: "guild-1",
        status: "active",
        reason: "blocked",
        label: "bad image",
        sourceUrl: null,
        sourceContentType: "image/png",
        sourceFilename: "image.png",
        hashes: await hashImageBuffer(png),
        addedBy: "mod-1",
        addedAt: new Date("2026-05-22T00:00:00.000Z"),
        removedBy: null,
        removedAt: null,
      },
    });
    const { createBridgeFromClient } = await import("./bot-bridge");
    const bridge = createBridgeFromClient(fakeClient() as never) as never as {
      testBannedImage: (
        guildId: string,
        input: { filename: string; contentType: string; bytes: Uint8Array },
      ) => Promise<{
        isOk(): boolean;
        unwrap(): {
          matched: boolean;
          record: { id: string } | null;
          distance: { total: number } | null;
        };
      }>;
    };

    const result = await bridge.testBannedImage("guild-1", {
      filename: "probe.png",
      contentType: "image/png",
      bytes: png,
    });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toMatchObject({
      matched: true,
      record: expect.objectContaining({ id: "img-1" }),
      distance: { average: 0, difference: 0, verticalDifference: 0, total: 0 },
    });
    expect(Object.keys(bridgeImages.get("guild-1") ?? {})).toEqual(["img-1"]);
  });

  it("does not fetch uncached guild status from Discord during dashboard reads", async () => {
    let fetches = 0;
    const client = fakeClient() as never as {
      guilds: {
        cache: Map<string, unknown>;
        fetch: (guildId: string) => Promise<unknown>;
      };
      on: () => void;
    };
    client.guilds.cache = new Map();
    client.guilds.fetch = async () => {
      fetches += 1;
      return { id: "guild-1", name: "Guild", memberCount: 10, iconURL: () => null };
    };
    const { createBridgeFromClient } = await import("./bot-bridge");
    const bridge = createBridgeFromClient(client as never);

    const result = await bridge.getGuildStatus("guild-1");

    expect(result.isErr()).toBe(true);
    expect(fetches).toBe(0);
  });

  it("rejects destructive actions when the actor lacks the required Discord permission", async () => {
    moderationCalls.length = 0;
    const { createBridgeFromClient } = await import("./bot-bridge");
    const bridge = createBridgeFromClient(fakeClient(false) as never) as never as {
      runModerationAction: (
        guildId: string,
        action: {
          type: "ban";
          moderatorId: string;
          targetUserId: string;
          reason: string;
        },
      ) => Promise<{ isErr(): boolean; error?: Error }>;
    };

    const result = await bridge.runModerationAction("guild-1", {
      type: "ban",
      moderatorId: "mod-1",
      targetUserId: "user-1",
      reason: "test",
    });

    expect(result.isErr()).toBe(true);
    expect(moderationCalls).toEqual([]);
  });

  it("rejects case edits when the actor lacks moderation permissions", async () => {
    moderationCalls.length = 0;
    const { createBridgeFromClient } = await import("./bot-bridge");
    const bridge = createBridgeFromClient(fakeClient(false) as never) as never as {
      editCase: (
        guildId: string,
        actorId: string,
        userId: string,
        caseId: number,
        description: string,
      ) => Promise<{ isErr(): boolean }>;
    };

    const result = await bridge.editCase("guild-1", "mod-1", "user-1", 1, "updated reason");

    expect(result.isErr()).toBe(true);
    expect(moderationCalls).toEqual([]);
  });

  it("rejects role policy edits when the actor lacks manage roles", async () => {
    guildWrites.length = 0;
    const { createBridgeFromClient } = await import("./bot-bridge");
    const bridge = createBridgeFromClient(fakeClient(false) as never) as never as {
      saveRolePolicy: (
        guildId: string,
        patch: { roleId: string; label: string; updatedBy: string },
      ) => Promise<{ isErr(): boolean }>;
    };

    const result = await bridge.saveRolePolicy("guild-1", {
      roleId: "verified",
      label: "Verified",
      updatedBy: "mod-1",
    });

    expect(result.isErr()).toBe(true);
    expect(guildWrites).toEqual([]);
  });

  it("saves, sends, and deletes embeds through the public bridge", async () => {
    embedConfigs.clear();
    sentEmbeds.length = 0;
    const { createBridgeFromClient } = await import("./bot-bridge");
    const bridge = createBridgeFromClient(fakeClient() as never);
    const seen: unknown[] = [];
    bridge.events.on("event", (event) => seen.push(event));

    const draft = {
      embedTitle: "Rules",
      embedDescription: "Read them.",
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
      stickyEnabled: true,
    };

    const saveResult = await bridge.saveEmbed("guild-1", "Rules!", draft, "mod-1");
    const sendResult = await bridge.sendEmbed("guild-1", "rules", "mod-1");
    const deleteResult = await bridge.deleteEmbed("guild-1", "rules", "mod-1");

    expect(saveResult.isOk()).toBe(true);
    expect(sendResult.isOk()).toBe(true);
    expect(deleteResult.isOk()).toBe(true);
    expect(sentEmbeds).toHaveLength(1);
    expect(seen).toContainEqual({
      type: "config_changed",
      guildId: "guild-1",
      actorId: "mod-1",
      detail: "Saved embed rules",
      timestamp: expect.any(Number),
    });
    expect(seen).toContainEqual({
      type: "config_changed",
      guildId: "guild-1",
      actorId: "mod-1",
      detail: "Sent embed rules",
      timestamp: expect.any(Number),
    });
    expect(seen).toContainEqual({
      type: "config_changed",
      guildId: "guild-1",
      actorId: "mod-1",
      detail: "Deleted embed rules",
      timestamp: expect.any(Number),
    });
  });

  it("forwards moderation bus events to SSE subscribers", async () => {
    const { createBridgeFromClient } = await import("./bot-bridge");
    const bridge = createBridgeFromClient(fakeClient() as never);
    const seen: unknown[] = [];
    bridge.events.on("event", (event) => seen.push(event));

    bus.emit({
      type: "mod:action",
      guildId: "guild-1",
      userId: "user-1",
      moderatorId: "mod-1",
      sanctionType: "BAN",
      caseId: 42,
    });
    await Promise.resolve();

    expect(seen).toContainEqual({
      type: "mod_action",
      guildId: "guild-1",
      actorId: "mod-1",
      targetId: "user-1",
      detail: "BAN case #42",
      timestamp: expect.any(Number),
    });
  });
});
