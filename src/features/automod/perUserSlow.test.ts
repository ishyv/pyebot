import { beforeEach, describe, expect, it } from "bun:test";
import { GuildSchema } from "@/db/schemas/guild";
import { clearPerUserSlowState, evaluatePerUserSlow, selectPerUserSlowRule } from "./perUserSlow";

function automod(overrides: Record<string, unknown> = {}) {
  return GuildSchema.parse({
    _id: "guild-1",
    automod: {
      perUserSlow: {
        enabled: true,
        rules: [
          {
            enabled: true,
            roleId: "slow",
            cooldownSeconds: 30,
            durationSeconds: 3600,
          },
        ],
      },
      ...overrides,
    },
  }).automod;
}

function input(now: number, roleIds: readonly string[] = ["slow"]) {
  return {
    guildId: "guild-1",
    userId: "user-1",
    channelId: "general",
    roleIds,
    isStaff: false,
    now,
  };
}

describe("per-user slow roles", () => {
  beforeEach(() => clearPerUserSlowState());

  it("allows the first message and escalates early attempts inside the cooldown", () => {
    const config = automod();

    expect(evaluatePerUserSlow(config, input(1_000)).action).toBe("allow");
    expect(evaluatePerUserSlow(config, input(2_000)).action).toBe("delete");
    expect(evaluatePerUserSlow(config, input(3_000)).action).toBe("warn");
    expect(evaluatePerUserSlow(config, input(4_000)).action).toBe("timeout");
  });

  it("resets violations after a clean cooldown gap", () => {
    const config = automod();

    expect(evaluatePerUserSlow(config, input(1_000)).action).toBe("allow");
    expect(evaluatePerUserSlow(config, input(2_000)).action).toBe("delete");
    expect(evaluatePerUserSlow(config, input(31_001)).action).toBe("allow");
    expect(evaluatePerUserSlow(config, input(32_000)).action).toBe("delete");
  });

  it("uses the strictest matching role when multiple slow roles apply", () => {
    const config = automod({
      perUserSlow: {
        enabled: true,
        rules: [
          { enabled: true, roleId: "slow", cooldownSeconds: 30, durationSeconds: 3600 },
          { enabled: true, roleId: "slower", cooldownSeconds: 90, durationSeconds: 3600 },
        ],
      },
    });

    const rule = selectPerUserSlowRule(config, input(1_000, ["slow", "slower"]));

    expect(rule?.roleId).toBe("slower");
    expect(evaluatePerUserSlow(config, input(1_000, ["slow", "slower"]))).toMatchObject({
      action: "allow",
      rule: { roleId: "slower" },
    });
  });

  it("respects staff and trusted-role bypass policy", () => {
    const config = automod({
      policy: {
        bypass: {
          staffBypass: true,
          ignoredChannelIds: [],
          strictChannelIds: [],
          trustedRoleIds: ["trusted"],
          protectedRoleIds: ["protected"],
        },
      },
    });

    expect(evaluatePerUserSlow(config, { ...input(1_000), isStaff: true }).action).toBe("allow");
    expect(evaluatePerUserSlow(config, input(1_000, ["slow", "trusted"])).rule).toBeNull();
    expect(evaluatePerUserSlow(config, input(1_000, ["slow", "protected"])).rule).toBeNull();
  });
});
