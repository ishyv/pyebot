import { getConfigPath } from "./config-path";

export interface EconomyPageValues {
  readonly register: "arcane";
  readonly daily: {
    readonly reward: number;
    readonly cooldownHours: number;
    readonly streakBonus: number;
  };
  readonly work: {
    readonly rewardBase: number;
    readonly cooldownMinutes: number;
    readonly dailyCap: number;
    readonly failureChance: number;
  };
  readonly tax: {
    readonly enabled: boolean;
    readonly rate: number;
    readonly minimumTaxableAmount: number;
  };
}

/**
 * Reads dashboard economy values from the same stores the bot uses.
 * Daily/work settings live in `guild_economy`; legacy tax settings still live
 * under the guild config until the tax feature is moved behind a component.
 */
export function readEconomyPageValues(adminState: Record<string, unknown>): EconomyPageValues {
  const economy = (adminState.economy ?? {}) as Record<string, unknown>;
  const guild = (adminState.guild ?? {}) as Record<string, unknown>;

  return {
    register: "arcane",
    daily: {
      reward: Number(getConfigPath(economy, "daily.dailyReward") ?? 250),
      cooldownHours: Number(getConfigPath(economy, "daily.dailyCooldownHours") ?? 24),
      streakBonus: Number(getConfigPath(economy, "daily.dailyStreakBonus") ?? 5),
    },
    work: {
      rewardBase: Number(getConfigPath(economy, "work.workRewardBase") ?? 120),
      cooldownMinutes: Number(getConfigPath(economy, "work.workCooldownMinutes") ?? 30),
      dailyCap: Number(getConfigPath(economy, "work.workDailyCap") ?? 5),
      failureChance: Number(getConfigPath(economy, "work.workFailureChance") ?? 0.1),
    },
    tax: {
      enabled: Boolean(getConfigPath(guild, "economy.tax.enabled")),
      rate: Number(getConfigPath(guild, "economy.tax.rate") ?? 0.05),
      minimumTaxableAmount: Number(getConfigPath(guild, "economy.tax.minimumTaxableAmount") ?? 100),
    },
  };
}
