import { describe, expect, it } from "bun:test";
import { recordAutomodIncident } from "./incidents";
import type { AutomodSignal } from "./signals";

function signal(userId: string): AutomodSignal {
  return {
    detectorId: "knownScam",
    ruleId: "knownScam:free-nitro",
    confidence: 0.98,
    severity: "critical",
    punishmentEligible: true,
    recommendedAction: "timeout",
    target: {
      guildId: "guild-1",
      userId,
      channelId: "channel-1",
      messageId: `${userId}-message`,
    },
    evidence: {
      summary: "free nitro scam",
      fingerprint: "free-nitro",
    },
    createdAt: "2026-05-13T12:00:00.000Z",
  };
}

describe("automod incidents", () => {
  it("groups related users by guild, detector, and evidence fingerprint", () => {
    const state = new Map();
    const first = recordAutomodIncident(state, signal("user-1"), {
      now: new Date("2026-05-13T12:00:00.000Z"),
      windowSeconds: 60,
    });
    const second = recordAutomodIncident(state, signal("user-2"), {
      now: new Date("2026-05-13T12:00:10.000Z"),
      windowSeconds: 60,
    });

    expect(first.id).toBe(second.id);
    expect(second.userIds).toEqual(["user-1", "user-2"]);
    expect(second.messageIds).toEqual(["user-1-message", "user-2-message"]);
  });
});
