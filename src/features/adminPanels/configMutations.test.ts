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
  getGuild: async (guildId: string) => OkResult({ _id: guildId, roles: {} }),
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
  it("writes economy daily and work settings onto the guild economy slice", async () => {
    const { saveEconomySettings } = await import("./configMutations");

    const result = await saveEconomySettings("guild-1", {
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

  it("writes image detection settings to the automod guild config path", async () => {
    const { saveAutomodSettings } = await import("./configMutations");

    const result = await saveAutomodSettings("guild-1", {
      imageDetection: {
        enabled: true,
        reportChannelId: "reports",
        tolerance: "strict",
      },
    });

    expect(result.isOk()).toBe(true);
    expect(guildWrites).toEqual([
      {
        guildId: "guild-1",
        paths: {
          "automod.imageDetection.enabled": true,
          "automod.imageDetection.reportChannelId": "reports",
          "automod.imageDetection.tolerance": "strict",
        },
        options: { upsert: true },
      },
    ]);
  });

  it("writes slash-command automod settings to exact guild config paths", async () => {
    const { saveAutomodSettings } = await import("./configMutations");

    const result = await saveAutomodSettings("guild-1", {
      domainWhitelist: {
        enabled: true,
        domains: ["example.com"],
      },
      crossChannelSpam: {
        enabled: true,
        minChannels: 4,
        windowSeconds: 45,
        reportChannelId: "reports",
        autoTimeout: false,
        timeoutSeconds: 900,
      },
      slowmode: {
        enabled: true,
        messagesPerWindow: 25,
        windowSeconds: 60,
        slowmodeSeconds: 10,
        releaseAfterSeconds: 120,
      },
      raidDetection: {
        enabled: true,
        joinsPerMinute: 12,
        minAccountAgeDays: 5,
        action: "alert",
        reportChannelId: "raid-reports",
      },
      policy: {
        preset: "strict",
        aiDetectorEnabled: true,
        staffBypass: false,
        profileRetentionDays: 60,
      },
      customPatterns: [
        {
          name: "invite",
          pattern: "discord\\.gg",
          flags: "i",
          action: "delete",
          timeoutSeconds: 300,
        },
      ],
      textRules: [
        {
          id: "badword",
          enabled: true,
          phrases: ["badword"],
          action: "timeout",
          timeoutSeconds: 900,
        },
      ],
    });

    expect(result.isOk()).toBe(true);
    expect(guildWrites).toEqual([
      {
        guildId: "guild-1",
        paths: {
          "automod.domainWhitelist.enabled": true,
          "automod.domainWhitelist.domains": ["example.com"],
          "automod.crossChannelSpam.enabled": true,
          "automod.crossChannelSpam.minChannels": 4,
          "automod.crossChannelSpam.windowSeconds": 45,
          "automod.crossChannelSpam.reportChannelId": "reports",
          "automod.crossChannelSpam.autoTimeout": false,
          "automod.crossChannelSpam.timeoutSeconds": 900,
          "automod.slowmode.enabled": true,
          "automod.slowmode.messagesPerWindow": 25,
          "automod.slowmode.windowSeconds": 60,
          "automod.slowmode.slowmodeSeconds": 10,
          "automod.slowmode.releaseAfterSeconds": 120,
          "automod.raidDetection.enabled": true,
          "automod.raidDetection.joinsPerMinute": 12,
          "automod.raidDetection.minAccountAgeDays": 5,
          "automod.raidDetection.action": "alert",
          "automod.raidDetection.reportChannelId": "raid-reports",
          "automod.policy.preset": "strict",
          "automod.policy.aiDetector.enabled": true,
          "automod.policy.bypass.staffBypass": false,
          "automod.policy.profileRetentionDays": 60,
          "automod.customPatterns": [
            {
              name: "invite",
              pattern: "discord\\.gg",
              flags: "i",
              action: "delete",
              timeoutSeconds: 300,
            },
          ],
          "automod.textRules": [
            {
              id: "badword",
              enabled: true,
              phrases: ["badword"],
              action: "timeout",
              timeoutSeconds: 900,
            },
          ],
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
