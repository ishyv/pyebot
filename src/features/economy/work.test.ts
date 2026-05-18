import { describe, expect, it } from "bun:test";
import { workConfigFromGuildEconomy } from "./work";

describe("work economy config", () => {
  it("maps live guild_economy work settings into work command config", () => {
    const config = workConfigFromGuildEconomy({
      work: {
        workRewardBase: 10,
        workBaseMintReward: 80,
        workBonusFromWorksMax: 40,
        workBonusScaleMode: "flat",
        workCooldownMinutes: 12,
        workDailyCap: 3,
        workCurrencyId: "gems",
        workPaysFromSector: "works",
        workFailureChance: 0,
      },
      daily: {
        dailyReward: 250,
        dailyCooldownHours: 24,
        dailyCurrencyId: "coins",
        dailyFeeRate: 0,
        dailyFeeSector: "tax",
        dailyStreakBonus: 5,
        dailyStreakCap: 10,
      },
      sectors: { global: 0, works: 0, trade: 0, tax: 0 },
    });

    expect(config).toEqual({
      cooldownMs: 12 * 60_000,
      minPayout: 80,
      maxPayout: 120,
      currencyId: "gems",
      dailyCap: 3,
    });
  });
});
