import { describe, expect, it, mock } from "bun:test";
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

mock.module("@/core/db", () => ({
  getDb: async () => ({
    collection: (name: string) => ({
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
        return { _id: "guild-1", daily: {}, work: {}, sectors: {} };
      },
      find: () => ({
        sort: () => ({
          limit: () => ({
            toArray: async () => [],
          }),
        }),
        limit: () => ({
          toArray: async () => [],
        }),
        toArray: async () => [],
      }),
      findOne: async () => null,
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
      automod: { linkSpam: {}, mentionSpam: {} },
      roles: {},
    }),
  getGuild: async (guildId: string) =>
    OkResult({
      _id: guildId,
      channels: { core: {} },
      moderation: { quarantine: { enabled: true, roleId: "quarantine-role" } },
      automod: { linkSpam: {}, mentionSpam: {} },
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
  resolveFeatureEnabled: () => true,
  setGuildFeatureOverride: async () => OkResult({ overrides: {} }),
  setGuildFeatureOverrides: async () => OkResult({ overrides: {} }),
}));

mock.module("@/core/featureCatalog", () => ({
  setFeatureCatalog: () => undefined,
  listFeatureCatalog: () => [{ id: "economy", defaultEnabled: true }],
  listConfigurableFeatures: () => [{ id: "economy", defaultEnabled: true }],
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
      fetch: async () => ({ isTextBased: () => true, send: async () => undefined }),
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
  it("writes economy settings to the guild_economy component collection", async () => {
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
    expect(guildWrites).toEqual([]);
    expect(collectionUpdates).toContainEqual({
      collection: "guild_economy",
      filter: { _id: "guild-1" },
      update: {
        $setOnInsert: { _id: "guild-1" },
        $set: {
          "daily.dailyReward": 777,
          "work.workDailyCap": 3,
          updatedAt: expect.any(Date),
        },
      },
      options: { upsert: true, returnDocument: "after" },
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
