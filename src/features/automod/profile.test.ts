import { describe, expect, it } from "bun:test";
import { updateAutomodProfile } from "./profile";
import type { AutomodSignal } from "./signals";

function signal(detectorId: string, createdAt: string): AutomodSignal {
  return {
    detectorId,
    confidence: 0.6,
    severity: "medium",
    punishmentEligible: false,
    recommendedAction: "report",
    target: {
      guildId: "guild-1",
      userId: "user-1",
      channelId: "channel-1",
    },
    evidence: { summary: detectorId },
    createdAt,
  };
}

describe("automod profile", () => {
  it("keeps only the rolling retention window and recalculates detector counts", () => {
    const profile = updateAutomodProfile(
      null,
      [
        signal("oldNoise", "2026-04-01T12:00:00.000Z"),
        signal("mentionSpam", "2026-05-12T12:00:00.000Z"),
        signal("mentionSpam", "2026-05-13T12:00:00.000Z"),
      ],
      {
        now: new Date("2026-05-13T12:00:00.000Z"),
        retentionDays: 30,
      },
    );

    expect(profile.signals.map((entry) => entry.detectorId)).toEqual([
      "mentionSpam",
      "mentionSpam",
    ]);
    expect(profile.detectorCounts).toEqual({ mentionSpam: 2 });
    expect(profile.riskScore).toBeGreaterThan(0);
  });
});
