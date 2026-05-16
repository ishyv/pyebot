import { describe, expect, it } from "bun:test";
import { GuildSchema } from "./guild";

describe("guild schema admin panel defaults", () => {
  it("builds the latest default panel config slices", () => {
    const guild = GuildSchema.parse({ _id: "guild-1" });

    expect(guild.channels.core.messageLogs).toBeNull();
    expect(guild.channels.core.offersReview).toBeNull();
    expect(guild.ai.rateLimit.perUserPerMinute).toBe(8);
    expect(guild.reputation.keywords).toEqual([]);
    expect(guild.forumAutoReply.enabled).toBe(false);
    expect(guild.tops.intervalHours).toBe(24);
    expect(guild.economy.features.store).toBe(true);
    expect(guild.features.counting).toBe(true);
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

  it("falls back to a safe recently joined policy when config is malformed", () => {
    const guild = GuildSchema.parse({
      _id: "guild-1",
      automod: { tempRolePolicies: { recentlyJoined: "oops" } },
    });

    expect(guild.automod.tempRolePolicies.recentlyJoined.enabled).toBe(false);
    expect(guild.automod.tempRolePolicies.recentlyJoined.messageRules).toEqual([]);
  });
});
