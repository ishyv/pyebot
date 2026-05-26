import { describe, expect, it } from "bun:test";
import { GuildSchema } from "./guild";

describe("guild schema admin panel defaults", () => {
  it("preserves default guild schema output for split-schema refactors", () => {
    const guild = GuildSchema.parse({ _id: "guild-1" });

    expect(guild.automod.imageDetection).toEqual({
      enabled: false,
      reportChannelId: null,
      tolerance: "balanced",
    });
    expect(guild.economy.daily).toEqual({
      dailyReward: 250,
      dailyCooldownHours: 24,
      dailyCurrencyId: "coins",
      dailyFeeRate: 0,
      dailyFeeSector: "tax",
      dailyStreakBonus: 5,
      dailyStreakCap: 10,
    });
    expect(guild.economy.work).toEqual({
      workRewardBase: 120,
      workBaseMintReward: 100,
      workBonusFromWorksMax: 100,
      workBonusScaleMode: "flat",
      workCooldownMinutes: 30,
      workDailyCap: 5,
      workCurrencyId: "coins",
      workPaysFromSector: "works",
      workFailureChance: 0.1,
    });
    expect(guild.moderation).toMatchObject({
      modLogChannelId: null,
      appealsChannelId: null,
      appealsQueueMessageId: null,
      altDetectionEnabled: false,
      escalation: { enabled: false, thresholds: [] },
      tempBanCheckIntervalMs: 60_000,
      quarantine: { enabled: false, roleId: null, channelId: null },
      verification: {
        enabled: false,
        mode: "button",
        minAccountAgeDays: 0,
        channelId: null,
        roleId: null,
        kickOnFail: false,
      },
      restrictionRoles: { forums: null, voice: null, jobs: null, all: null },
    });
    expect(Object.hasOwn(guild.economy, "sectors")).toBe(false);
  });

  it("preserves representative guild schema output across parse idempotence", () => {
    const rawGuild = {
      _id: "guild-full",
      roles: {
        mods: {
          label: "Mods",
          discordRoleId: "role-mod",
          reach: { ban: "allow", warn: "inherit" },
          limits: { warn: { limit: 3, window: "1h", windowSeconds: 3600 } },
          updatedBy: "admin",
          updatedAt: "2026-05-01T00:00:00.000Z",
        },
      },
      channels: {
        core: { logs: { channelId: "logs" }, reports: null },
        managed: { rules: { id: "rules", label: "Rules", channelId: "rules-channel" } },
        ticketMessageId: "ticket-message",
        ticketHelperRoles: ["support"],
        ticketCategoryId: "tickets",
      },
      automod: {
        linkSpam: {
          enabled: true,
          maxLinks: 3,
          windowSeconds: 20,
          timeoutSeconds: 600,
          action: "timeout",
          reportChannelId: "reports",
        },
        domainWhitelist: { enabled: true, domains: ["example.com"] },
        shorteners: {
          enabled: true,
          resolveFinalUrl: true,
          allowedShorteners: ["bit.ly"],
        },
        crossChannelSpam: {
          enabled: true,
          minChannels: 4,
          windowSeconds: 45,
          reportChannelId: "reports",
          autoTimeout: false,
          timeoutSeconds: 900,
        },
        mentionSpam: {
          enabled: true,
          maxMentions: 6,
          windowSeconds: 12,
          action: "delete",
          timeoutSeconds: 300,
          reportChannelId: "reports",
        },
        slowmode: {
          enabled: true,
          messagesPerWindow: 10,
          windowSeconds: 30,
          slowmodeSeconds: 5,
          releaseAfterSeconds: 120,
        },
        raidDetection: {
          enabled: true,
          joinsPerMinute: 8,
          minAccountAgeDays: 5,
          action: "alert",
          reportChannelId: "reports",
        },
        customPatterns: [
          { name: "slur", pattern: "bad", flags: "i", action: "delete", timeoutSeconds: 300 },
        ],
        tempRolePolicies: {
          recentlyJoined: {
            enabled: true,
            roleId: "new",
            durationSeconds: 604800,
            maxAccountAgeDays: 14,
            skipRoleIds: ["verified"],
            reportChannelId: "reports",
            messageRules: [
              {
                id: "links-general",
                enabled: true,
                kind: "links",
                action: "timeout",
                channelIds: ["general"],
                categoryIds: [],
                limit: 2,
                windowSeconds: 600,
                timeoutSeconds: 300,
                pattern: null,
              },
            ],
            accessRules: [
              {
                id: "hide-support",
                enabled: true,
                targetId: "support",
                targetType: "category",
                mode: "view",
              },
            ],
          },
        },
        perUserSlow: {
          enabled: true,
          rules: [{ enabled: true, roleId: "slow", cooldownSeconds: 30, durationSeconds: 3600 }],
        },
        imageDetection: {
          enabled: true,
          reportChannelId: "reports",
          tolerance: "strict",
        },
        policy: {
          preset: "strict",
          profileRetentionDays: 45,
          aiDetector: { enabled: true, minConfidence: 0.8 },
          bypass: {
            staffBypass: false,
            ignoredChannelIds: ["off-topic"],
            strictChannelIds: ["general"],
            trustedRoleIds: ["trusted"],
            protectedRoleIds: ["protected"],
          },
          alertRateLimit: { windowSeconds: 90, maxAlerts: 5 },
          actionRateLimit: { windowSeconds: 120, maxActions: 4 },
        },
      },
      moderation: {
        modLogChannelId: "mod-log",
        appealsChannelId: "appeals",
        appealsQueueMessageId: "appeal-msg",
        altDetectionEnabled: true,
        escalation: {
          enabled: true,
          thresholds: [{ warnCount: 3, action: "timeout", durationKey: "1h" }],
        },
        tempBanCheckIntervalMs: 120000,
        quarantine: { enabled: true, roleId: "quarantine", channelId: "quarantine-log" },
        verification: {
          enabled: true,
          mode: "account_age",
          minAccountAgeDays: 7,
          channelId: "verify",
          roleId: "verified",
          kickOnFail: true,
        },
        restrictionRoles: { forums: "rf", voice: "rv", jobs: "rj", all: "ra" },
      },
      economy: {
        features: {
          coinflip: true,
          trivia: false,
          rob: true,
          voting: true,
          crafting: true,
          store: false,
        },
        tax: { enabled: true, rate: 0.1, minimumTaxableAmount: 500, taxSector: "tax" },
        thresholds: { warning: 1000, alert: 5000, critical: 10000 },
        daily: {
          dailyReward: 300,
          dailyCooldownHours: 12,
          dailyCurrencyId: "coins",
          dailyFeeRate: 0.02,
          dailyFeeSector: "tax",
          dailyStreakBonus: 7,
          dailyStreakCap: 14,
        },
        work: {
          workRewardBase: 150,
          workBaseMintReward: 120,
          workBonusFromWorksMax: 80,
          workBonusScaleMode: "percent",
          workCooldownMinutes: 20,
          workDailyCap: 10,
          workCurrencyId: "coins",
          workPaysFromSector: "works",
          workFailureChance: 0.05,
        },
        progression: {
          enabled: true,
          xpAmounts: { daily_claim: 10 },
          cooldownSeconds: { daily_claim: 0 },
        },
        sectors: { global: 10, works: 20, trade: 30, tax: 40 },
      },
    };

    const parsed = GuildSchema.parse(rawGuild);
    expect(GuildSchema.parse(parsed)).toEqual(parsed);
  });

  it("builds the latest default panel config slices", () => {
    const guild = GuildSchema.parse({ _id: "guild-1" });

    expect(guild.channels.core.messageLogs).toBeNull();
    expect(guild.channels.core.offersReview).toBeNull();
    expect(guild.ai.rateLimit.perUserPerMinute).toBe(8);
    expect(guild.reputation.keywords).toEqual([]);
    expect(guild.forumAutoReply.enabled).toBe(false);
    expect(guild.tops.intervalHours).toBe(24);
    expect(guild.economy.features.store).toBe(true);
    expect(guild.counting.channelId).toBeNull();
  });

  it("rejects malformed old panel config slices", () => {
    expect(() => GuildSchema.parse({ _id: "guild-1", channels: "general" })).toThrow();
  });

  it("accepts typed role policies", () => {
    const guild = GuildSchema.parse({
      _id: "guild-1",
      roles: {
        mods: {
          label: "Mods",
          discordRoleId: "role-1",
          reach: { ban: "deny" },
          limits: { warn: { limit: 3, window: "1h", windowSeconds: 3600 } },
        },
      },
    });

    expect(guild.roles.mods.reach.ban).toBe("deny");
    expect(guild.roles.mods.limits.warn.limit).toBe(3);
  });

  it("defaults recently joined temp-role policy to disabled", () => {
    const guild = GuildSchema.parse({ _id: "guild-1" });

    expect(guild.automod.tempRolePolicies.recentlyJoined.enabled).toBe(false);
    expect(guild.automod.tempRolePolicies.recentlyJoined.roleId).toBeNull();
    expect(guild.automod.tempRolePolicies.recentlyJoined.messageRules).toEqual([]);
    expect(guild.automod.tempRolePolicies.recentlyJoined.accessRules).toEqual([]);
  });

  it("accepts explicit recently joined policy rules", () => {
    const guild = GuildSchema.parse({
      _id: "guild-1",
      automod: {
        tempRolePolicies: {
          recentlyJoined: {
            enabled: true,
            roleId: "role-new",
            durationSeconds: 604800,
            maxAccountAgeDays: 14,
            skipRoleIds: ["verified"],
            reportChannelId: "reports",
            messageRules: [
              {
                id: "links-general",
                enabled: true,
                kind: "links",
                action: "timeout",
                channelIds: ["general"],
                categoryIds: [],
                limit: 2,
                windowSeconds: 600,
                timeoutSeconds: 300,
                pattern: null,
              },
            ],
            accessRules: [
              {
                id: "hide-support",
                enabled: true,
                targetId: "support-category",
                targetType: "category",
                mode: "view",
              },
            ],
          },
        },
      },
    });

    const policy = guild.automod.tempRolePolicies.recentlyJoined;
    expect(policy.enabled).toBe(true);
    expect(policy.messageRules[0]?.kind).toBe("links");
    expect(policy.accessRules[0]?.mode).toBe("view");
  });

  it("does not generate IDs for malformed recently joined rules", () => {
    const guild = GuildSchema.parse({
      _id: "guild-1",
      automod: {
        tempRolePolicies: {
          recentlyJoined: {
            enabled: true,
            messageRules: [{ enabled: true, kind: "links", action: "report" }],
          },
        },
      },
    });

    expect(guild.automod.tempRolePolicies.recentlyJoined).toMatchObject({
      enabled: false,
      messageRules: [],
      accessRules: [],
    });
  });

  it("falls back to a safe recently joined policy when config is malformed", () => {
    const guild = GuildSchema.parse({
      _id: "guild-1",
      automod: { tempRolePolicies: { recentlyJoined: "oops" } },
    });

    expect(guild.automod.tempRolePolicies.recentlyJoined.enabled).toBe(false);
    expect(guild.automod.tempRolePolicies.recentlyJoined.messageRules).toEqual([]);
  });

  it("accepts per-user slow role rules", () => {
    const guild = GuildSchema.parse({
      _id: "guild-1",
      automod: {
        perUserSlow: {
          enabled: true,
          rules: [
            {
              enabled: true,
              roleId: "slow-role",
              cooldownSeconds: 30,
              durationSeconds: 3600,
            },
          ],
        },
      },
    });

    expect(guild.automod.perUserSlow.enabled).toBe(true);
    expect(guild.automod.perUserSlow.rules[0]).toMatchObject({
      roleId: "slow-role",
      cooldownSeconds: 30,
      durationSeconds: 3600,
    });
  });
});
