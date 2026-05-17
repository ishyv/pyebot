import { describe, expect, test } from "bun:test";
import { GuildSchema } from "./guild";
import { RpgProfileSchema } from "./rpg-profile";
import { UserSchema } from "./user";

describe("UserSchema", () => {
  test("parses minimal doc with _id", () => {
    const result = UserSchema.safeParse({ _id: "user123" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data._id).toBe("user123");
      expect(result.data.warns).toEqual([]);
      expect(result.data.currency).toEqual({});
    }
  });

  test("applies catch defaults for invalid warns", () => {
    const result = UserSchema.safeParse({ _id: "x", warns: "bad" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.warns).toEqual([]);
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

  test("applies catch defaults for invalid automod", () => {
    const result = GuildSchema.safeParse({ _id: "g1", automod: "bad" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.automod.linkSpam.enabled).toBe(false);
      expect(result.data.automod.policy.preset).toBe("balanced");
      expect(result.data.automod.policy.profileRetentionDays).toBe(30);
    }
  });
});

describe("RpgProfileSchema", () => {
  test("parses empty object with defaults", () => {
    const result = RpgProfileSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hpCurrent).toBe(100);
      expect(result.data.wins).toBe(0);
      expect(result.data.isFighting).toBe(false);
    }
  });

  test("preserves valid data", () => {
    const result = RpgProfileSchema.safeParse({
      hpCurrent: 75,
      wins: 3,
      losses: 1,
      isFighting: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hpCurrent).toBe(75);
      expect(result.data.wins).toBe(3);
    }
  });
});
