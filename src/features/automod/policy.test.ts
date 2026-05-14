import { describe, expect, it } from "bun:test";
import { GuildSchema } from "@/db/schemas/guild";
import { evaluateAutomodPolicy } from "./policy";
import { updateAutomodProfile } from "./profile";
import type { AutomodSignal } from "./signals";

const baseConfig = GuildSchema.parse({
  _id: "guild-1",
  automod: {
    policy: {
      preset: "balanced",
      profileRetentionDays: 30,
      aiDetector: { enabled: false },
      bypass: {
        staffBypass: true,
        ignoredChannelIds: [],
        strictChannelIds: [],
        trustedRoleIds: [],
        protectedRoleIds: [],
      },
      alertRateLimit: { windowSeconds: 60, maxAlerts: 4 },
      actionRateLimit: { windowSeconds: 60, maxActions: 3 },
    },
  },
}).automod;

function signal(
  id: string,
  confidence: number,
  severity: AutomodSignal["severity"],
  punishmentEligible: boolean,
): AutomodSignal {
  return {
    detectorId: id,
    ruleId: `${id}:rule`,
    confidence,
    severity,
    punishmentEligible,
    recommendedAction: "delete",
    target: {
      guildId: "guild-1",
      userId: "user-1",
      channelId: "channel-1",
      messageId: "message-1",
    },
    evidence: {
      summary: `${id} evidence`,
    },
    createdAt: "2026-05-13T12:00:00.000Z",
  };
}

describe("automod policy", () => {
  it("reports soft signals before they become punishment-worthy", () => {
    const profile = updateAutomodProfile(null, [signal("capsFlood", 0.45, "low", false)], {
      now: new Date("2026-05-13T12:00:00.000Z"),
      retentionDays: 30,
    });

    const decision = evaluateAutomodPolicy({
      config: baseConfig,
      profile,
      signals: [signal("capsFlood", 0.45, "low", false)],
      member: { isStaff: false, roleIds: [] },
      channelId: "channel-1",
    });

    expect(decision.tier).toBe("report");
    expect(decision.action).toBe("report");
    expect(decision.destructive).toBe(false);
  });

  it("times out repeated high-confidence punishment signals", () => {
    const first = signal("knownScam", 0.96, "critical", true);
    const second = { ...first, createdAt: "2026-05-13T12:00:10.000Z" };
    const profile = updateAutomodProfile(null, [first, second], {
      now: new Date("2026-05-13T12:00:10.000Z"),
      retentionDays: 30,
    });

    const decision = evaluateAutomodPolicy({
      config: baseConfig,
      profile,
      signals: [second],
      member: { isStaff: false, roleIds: [] },
      channelId: "channel-1",
    });

    expect(decision.tier).toBe("timeout");
    expect(decision.action).toBe("timeout");
    expect(decision.destructive).toBe(true);
  });

  it("observes protected staff when staff bypass is enabled", () => {
    const decision = evaluateAutomodPolicy({
      config: baseConfig,
      profile: updateAutomodProfile(null, [], {
        now: new Date("2026-05-13T12:00:00.000Z"),
        retentionDays: 30,
      }),
      signals: [signal("knownScam", 0.99, "critical", true)],
      member: { isStaff: true, roleIds: [] },
      channelId: "channel-1",
    });

    expect(decision.tier).toBe("observe");
    expect(decision.action).toBe("none");
  });
});
