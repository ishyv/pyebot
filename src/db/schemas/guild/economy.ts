import { z } from "zod";

export const EconomySectorEnum = z.union([
  z.literal("global"),
  z.literal("works"),
  z.literal("trade"),
  z.literal("tax"),
]);

export const DailyConfigSchema = z.object({
  dailyReward: z.number().int().catch(250),
  dailyCooldownHours: z.number().int().catch(24),
  dailyCurrencyId: z.string().catch("coins"),
  dailyFeeRate: z.number().min(0).max(0.2).catch(0.0),
  dailyFeeSector: EconomySectorEnum.catch(() => "tax" as const),
  dailyStreakBonus: z.number().int().min(0).catch(5),
  dailyStreakCap: z.number().int().min(0).catch(10),
});

export const WorkConfigSchema = z.object({
  workRewardBase: z.number().int().catch(120),
  workBaseMintReward: z.number().int().min(0).catch(100),
  workBonusFromWorksMax: z.number().int().min(0).catch(100),
  workBonusScaleMode: z.enum(["flat", "percent"]).catch("flat"),
  workCooldownMinutes: z.number().int().catch(30),
  workDailyCap: z.number().int().catch(5),
  workCurrencyId: z.string().catch("coins"),
  workPaysFromSector: EconomySectorEnum.catch(() => "works" as const),
  workFailureChance: z.number().min(0).max(1).catch(0.1),
});

export function defaultEconomyConfig() {
  return {
    features: {
      coinflip: true,
      trivia: true,
      rob: true,
      voting: true,
      crafting: true,
      store: true,
    },
    tax: { enabled: false, rate: 0.05, minimumTaxableAmount: 100, taxSector: "tax" as const },
    thresholds: { warning: 5_000, alert: 25_000, critical: 100_000 },
    daily: DailyConfigSchema.parse({}),
    work: WorkConfigSchema.parse({}),
    progression: {
      enabled: true,
      xpAmounts: {
        daily_claim: 60,
        work_claim: 25,
        store_buy: 15,
        store_sell: 10,
        quest_complete: 120,
        craft: 10,
      },
      cooldownSeconds: {
        daily_claim: 0,
        work_claim: 0,
        store_buy: 15,
        store_sell: 15,
        quest_complete: 0,
        craft: 0,
      },
    },
  };
}

export const EconomyConfigSchema = z
  .object({
    features: z
      .object({
        coinflip: z.boolean().catch(true),
        trivia: z.boolean().catch(true),
        rob: z.boolean().catch(true),
        voting: z.boolean().catch(true),
        crafting: z.boolean().catch(true),
        store: z.boolean().catch(true),
      })
      .catch(() => ({
        coinflip: true,
        trivia: true,
        rob: true,
        voting: true,
        crafting: true,
        store: true,
      })),
    tax: z
      .object({
        enabled: z.boolean().catch(false),
        rate: z.number().min(0).max(1).catch(0.05),
        minimumTaxableAmount: z.number().int().min(0).catch(100),
        taxSector: EconomySectorEnum.catch(() => "tax" as const),
      })
      .catch(() => ({
        enabled: false,
        rate: 0.05,
        minimumTaxableAmount: 100,
        taxSector: "tax" as const,
      })),
    thresholds: z
      .object({
        warning: z.number().int().min(0).catch(5_000),
        alert: z.number().int().min(0).catch(25_000),
        critical: z.number().int().min(0).catch(100_000),
      })
      .catch(() => ({ warning: 5_000, alert: 25_000, critical: 100_000 })),
    daily: DailyConfigSchema.catch(() => DailyConfigSchema.parse({})),
    work: WorkConfigSchema.catch(() => WorkConfigSchema.parse({})),
    progression: z
      .object({
        enabled: z.boolean().catch(true),
        xpAmounts: z.record(z.string(), z.number().int().min(0)).catch(() => ({
          daily_claim: 60,
          work_claim: 25,
          store_buy: 15,
          store_sell: 10,
          quest_complete: 120,
          craft: 10,
        })),
        cooldownSeconds: z.record(z.string(), z.number().int().min(0)).catch(() => ({
          daily_claim: 0,
          work_claim: 0,
          store_buy: 15,
          store_sell: 15,
          quest_complete: 0,
          craft: 0,
        })),
      })
      .catch(() => ({
        enabled: true,
        xpAmounts: {
          daily_claim: 60,
          work_claim: 25,
          store_buy: 15,
          store_sell: 10,
          quest_complete: 120,
          craft: 10,
        },
        cooldownSeconds: {
          daily_claim: 0,
          work_claim: 0,
          store_buy: 15,
          store_sell: 15,
          quest_complete: 0,
          craft: 0,
        },
      })),
    sectors: z
      .object({
        global: z.number().catch(0),
        works: z.number().catch(0),
        trade: z.number().catch(0),
        tax: z.number().catch(0),
      })
      .optional()
      .catch(() => ({ global: 0, works: 0, trade: 0, tax: 0 })),
  })
  .catch(() => defaultEconomyConfig());
