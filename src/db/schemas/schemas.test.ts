import { describe, expect, test } from "bun:test";
import { GuildSchema } from "./guild";
import { UserSchema } from "./user";

describe("UserSchema", () => {
  test("parses minimal doc with _id", () => {
    const result = UserSchema.safeParse({ _id: "user123" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data._id).toBe("user123");
      expect(result.data.sanction_history).toEqual({});
      expect(result.data.mod_notes).toEqual({});
      expect(result.data.quarantine_roles).toEqual({});
    }
  });

  test("preserves active moderation state", () => {
    const result = UserSchema.safeParse({
      _id: "x",
      sanction_history: {
        guild1: [
          {
            type: "WARN",
            description: "spam",
            caseId: 12,
            moderatorId: "mod1",
          },
        ],
      },
      mod_notes: {
        guild1: [{ note: "watch", moderatorId: "mod1", createdAt: "2026-05-24T00:00:00Z" }],
      },
      quarantine_roles: {
        guild1: ["role1"],
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sanction_history.guild1?.[0]?.type).toBe("WARN");
      expect(result.data.mod_notes.guild1?.[0]?.note).toBe("watch");
      expect(result.data.quarantine_roles.guild1).toEqual(["role1"]);
    }
  });

  test("drops legacy RPG, economy, minigame, voting, warn, and ticket bags", () => {
    const result = UserSchema.parse({
      _id: "x",
      warns: [{ reason: "old", warn_id: "1", moderator: "m", timestamp: "t" }],
      openTickets: ["channel1"],
      currency: { coins: 1 },
      inventory: { stone: 3 },
      bank: { coins: 1 },
      economyAccount: { status: "active" },
      rpgProfile: { hpCurrent: 50 },
      minigames: { trivia: true },
      votingStats: { votes: 1 },
      voteAggregates: { total: 1 },
      votingPrefs: { showVotes: true },
    });

    expect("warns" in result).toBe(false);
    expect("openTickets" in result).toBe(false);
    expect("currency" in result).toBe(false);
    expect("inventory" in result).toBe(false);
    expect("bank" in result).toBe(false);
    expect("economyAccount" in result).toBe(false);
    expect("rpgProfile" in result).toBe(false);
    expect("minigames" in result).toBe(false);
    expect("votingStats" in result).toBe(false);
    expect("voteAggregates" in result).toBe(false);
    expect("votingPrefs" in result).toBe(false);
  });
});

describe("GuildSchema", () => {
  test("parses minimal doc with _id", () => {
    const result = GuildSchema.safeParse({ _id: "guild123" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data._id).toBe("guild123");
      expect(result.data.channels.core).toBeDefined();
    }
  });

  test("defaults missing automod for new documents", () => {
    const result = GuildSchema.safeParse({ _id: "g1" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.automod.linkSpam.enabled).toBe(false);
      expect(result.data.automod.perUserSlow.enabled).toBe(false);
      expect(result.data.automod.perUserSlow.rules).toEqual([]);
      expect(result.data.automod.imageDetection.enabled).toBe(false);
      expect(result.data.automod.imageDetection.reportChannelId).toBeNull();
      expect(result.data.automod.imageDetection.tolerance).toBe("balanced");
      expect(result.data.automod.policy.preset).toBe("balanced");
      expect(result.data.automod.policy.profileRetentionDays).toBe(30);
    }
  });

  test("rejects malformed top-level automod config", () => {
    const result = GuildSchema.safeParse({ _id: "g1", automod: "bad" });
    expect(result.success).toBe(false);
  });
});
