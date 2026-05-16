import { beforeEach, describe, expect, it } from "bun:test";
import { GuildSchema } from "@/db/schemas/guild";
import {
  clearTempRolePolicyState,
  detectTempRolePolicySignalsFromInput,
  shouldAssignTempRolePolicy,
} from "./tempRolePolicy";

function recentlyJoined(overrides: Record<string, unknown> = {}) {
  return GuildSchema.parse({
    _id: "guild-1",
    automod: {
      tempRolePolicies: {
        recentlyJoined: {
          enabled: true,
          roleId: "recent",
          durationSeconds: 604800,
          maxAccountAgeDays: 14,
          skipRoleIds: [],
          reportChannelId: null,
          messageRules: [],
          accessRules: [],
          ...overrides,
        },
      },
    },
  }).automod.tempRolePolicies.recentlyJoined;
}

describe("temp-role policy", () => {
  beforeEach(() => clearTempRolePolicyState());

  it("assigns only when enabled, within account age, and not already trusted", () => {
    const policy = recentlyJoined({ skipRoleIds: ["verified"] });
    const now = Date.parse("2026-05-15T12:00:00.000Z");

    expect(
      shouldAssignTempRolePolicy(policy, {
        now,
        accountCreatedAt: Date.parse("2026-05-10T12:00:00.000Z"),
        roleIds: [],
      }),
    ).toBe(true);

    expect(
      shouldAssignTempRolePolicy(policy, {
        now,
        accountCreatedAt: Date.parse("2026-05-10T12:00:00.000Z"),
        roleIds: ["verified"],
      }),
    ).toBe(false);
  });

  it("emits scoped link signals only for members carrying the temp role", () => {
    const policy = recentlyJoined({
      messageRules: [
        {
          id: "links-general",
          enabled: true,
          kind: "links",
          action: "timeout",
          channelIds: ["general"],
          categoryIds: [],
          limit: 1,
          windowSeconds: 600,
          timeoutSeconds: 300,
          pattern: null,
        },
      ],
    });

    const input = {
      guildId: "guild-1",
      userId: "user-1",
      channelId: "general",
      parentId: null,
      messageId: "message-1",
      roleIds: ["recent"],
      content: "look https://example.com",
      attachmentCount: 0,
      stickerCount: 0,
      mentionCount: 0,
      createdAt: "2026-05-15T12:00:00.000Z",
    };

    const signals = detectTempRolePolicySignalsFromInput(input, policy);
    expect(signals).toHaveLength(1);
    expect(signals[0]?.detectorId).toBe("tempRole:links");
    expect(signals[0]?.recommendedAction).toBe("timeout");

    expect(detectTempRolePolicySignalsFromInput({ ...input, roleIds: [] }, policy)).toEqual([]);
    expect(
      detectTempRolePolicySignalsFromInput({ ...input, channelId: "off-topic" }, policy),
    ).toEqual([]);
  });
});
