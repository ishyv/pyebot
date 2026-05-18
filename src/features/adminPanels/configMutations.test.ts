import { beforeEach, describe, expect, it, mock } from "bun:test";
import { OkResult } from "@/core/result";

const collectionUpdates: Array<{
  collection: string;
  filter: unknown;
  update: Record<string, unknown>;
  options: unknown;
}> = [];

const guildWrites: Array<{ guildId: string; paths: Record<string, unknown>; options: unknown }> =
  [];

const featureWrites: Array<{ guildId: string; featureId: string; enabled: boolean }> = [];

mock.module("@/core/db", () => ({
  getDb: async () => ({
    collection: (name: string) => ({
      findOneAndUpdate: async (
        filter: unknown,
        update: Record<string, unknown>,
        options: unknown,
      ) => {
        collectionUpdates.push({ collection: name, filter, update, options });
        return { _id: "guild-1", daily: {}, work: {}, sectors: {} };
      },
    }),
  }),
}));

mock.module("@/db/repositories/guilds", () => ({
  updateGuildPaths: async (guildId: string, paths: Record<string, unknown>, options: unknown) => {
    guildWrites.push({ guildId, paths, options });
    return OkResult(undefined);
  },
}));

mock.module("@/components/guild-features", () => ({
  setGuildFeatureOverride: async (guildId: string, featureId: string, enabled: boolean) => {
    featureWrites.push({ guildId, featureId, enabled });
    return OkResult({ overrides: { [featureId]: enabled } });
  },
  setGuildFeatureOverrides: async (guildId: string, overrides: Record<string, boolean>) => {
    for (const [featureId, enabled] of Object.entries(overrides)) {
      featureWrites.push({ guildId, featureId, enabled });
    }
    return OkResult({ overrides });
  },
}));

beforeEach(() => {
  collectionUpdates.length = 0;
  guildWrites.length = 0;
  featureWrites.length = 0;
});

describe("admin panel config mutations", () => {
  it("writes economy daily and work settings to the GuildEconomy component store", async () => {
    const { saveEconomySettings } = await import("./configMutations");

    const result = await saveEconomySettings("guild-1", {
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

  it("keeps channel and moderation config writes on the guild config document", async () => {
    const { saveChannelSettings, saveModerationSettings } = await import("./configMutations");

    const channelResult = await saveChannelSettings("guild-1", {
      modlog: "channel-1",
      logs: null,
    });
    const moderationResult = await saveModerationSettings("guild-1", {
      modLogChannelId: "channel-2",
      quarantineRoleId: null,
    });

    expect(channelResult.isOk()).toBe(true);
    expect(moderationResult.isOk()).toBe(true);
    expect(guildWrites).toEqual([
      {
        guildId: "guild-1",
        paths: {
          "channels.core.modlog": { channelId: "channel-1" },
          "channels.core.logs": null,
        },
        options: { upsert: true },
      },
      {
        guildId: "guild-1",
        paths: {
          "channels.core.modlog": { channelId: "channel-2" },
          "moderation.quarantine.roleId": null,
          "moderation.quarantine.enabled": false,
        },
        options: { upsert: true },
      },
    ]);
  });

  it("routes feature toggles through the GuildFeatures component helper", async () => {
    const { toggleFeatureSetting } = await import("./configMutations");

    const result = await toggleFeatureSetting("guild-1", "economy", false);

    expect(result.isOk()).toBe(true);
    expect(featureWrites).toEqual([{ guildId: "guild-1", featureId: "economy", enabled: false }]);
    expect(guildWrites).toEqual([]);
    expect(collectionUpdates).toEqual([]);
  });
});
