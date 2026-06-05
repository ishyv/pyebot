import { describe, expect, it } from "bun:test";
import { EconomyConfigSchema } from "@/db/schemas/guild";
import { workConfigFromGuildEconomy } from "./work";

describe("work economy config", () => {
  it("maps live guild economy work settings into work command config", () => {
    const config = workConfigFromGuildEconomy(
      EconomyConfigSchema.parse({
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
      }),
    );

    expect(config).toEqual({
      cooldownMs: 12 * 60_000,
      minPayout: 80,
      maxPayout: 120,
      currencyId: "gems",
      dailyCap: 3,
    });
  });
});
