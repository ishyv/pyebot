import { describe, expect, it } from "bun:test";
import { GuildSchema } from "@/db/schemas/guild";
import {
  accessOverwritePreview,
  formatTempRoleAccessRule,
  formatTempRoleMessageRule,
  parseDurationSeconds,
} from "./newUsersPolicy";

const policy = GuildSchema.parse({
  _id: "guild-1",
  automod: {
    tempRolePolicies: {
      recentlyJoined: {
        enabled: true,
        roleId: "recent",
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
            id: "block-support",
            enabled: true,
            targetId: "support",
            targetType: "category",
            mode: "send",
          },
        ],
      },
    },
  },
}).automod.tempRolePolicies.recentlyJoined;

describe("new users panel policy helpers", () => {
  it("parses compact durations into seconds", () => {
    expect(parseDurationSeconds("10m")).toEqual({ ok: true, seconds: 600 });
    expect(parseDurationSeconds("2h")).toEqual({ ok: true, seconds: 7200 });
    expect(parseDurationSeconds("7d")).toEqual({ ok: true, seconds: 604800 });
    expect(parseDurationSeconds("forever").ok).toBe(false);
  });

  it("formats message rules in human language", () => {
    expect(formatTempRoleMessageRule(policy.messageRules[0]!)).toContain(
      "Links: 2 per 600s in <#general> -> timeout for 300s",
    );
  });

  it("formats and previews access blocklist rules", () => {
    expect(formatTempRoleAccessRule(policy.accessRules[0]!)).toBe(
      "Block sending in category support",
    );
    expect(accessOverwritePreview(policy)).toContain(
      "Recently Joined cannot send messages in category support",
    );
  });
});
