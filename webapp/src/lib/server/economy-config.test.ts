import { describe, expect, it } from "vitest";
import { readEconomyPageValues } from "./economy-config";

describe("dashboard economy config reader", () => {
  it("reads daily and work values from the live GuildEconomy component snapshot", () => {
    const values = readEconomyPageValues({
      economy: {
        daily: {
          dailyReward: 777,
          dailyCooldownHours: 12,
          dailyStreakBonus: 9,
        },
        work: {
          workRewardBase: 222,
          workCooldownMinutes: 15,
          workDailyCap: 3,
          workFailureChance: 0.25,
        },
      },
      guild: {
        economy: {
          daily: { dailyReward: 111 },
          work: { workRewardBase: 111 },
          tax: {
            enabled: true,
            rate: 0.07,
            minimumTaxableAmount: 500,
          },
        },
      },
    });

    expect(values.daily).toEqual({
      reward: 777,
      cooldownHours: 12,
      streakBonus: 9,
    });
    expect(values.work).toEqual({
      rewardBase: 222,
      cooldownMinutes: 15,
      dailyCap: 3,
      failureChance: 0.25,
    });
    expect(values.tax).toEqual({
      enabled: true,
      rate: 0.07,
      minimumTaxableAmount: 500,
    });
  });
});
