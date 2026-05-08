import { describe, expect, it } from "bun:test";
import { GuildSchema } from "./guild";

describe("guild schema admin panel defaults", () => {
  it("normalizes legacy panel config slices", () => {
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
});
