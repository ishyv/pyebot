/**
 * GuildEconomy — per-guild parameters for the economy feature:
 * daily-reward rates, work-reward rates, and the sector pools that
 * back currency emission.
 *
 * Stored separately from currency wallets because admins tune this once
 * (or rarely) and the feature reads it on every economy interaction.
 * Caching it independently keeps reads cheap.
 */

import { z } from "zod";
import { component } from "@/framework/component";

const EconomySector = z.union([
  z.literal("global"),
  z.literal("works"),
  z.literal("trade"),
  z.literal("tax"),
]);

const DailyConfig = z.object({
  dailyReward: z.number().int().default(250),
  dailyCooldownHours: z.number().int().default(24),
  dailyCurrencyId: z.string().default("coins"),
  dailyFeeRate: z.number().min(0).max(0.2).default(0),
  dailyFeeSector: EconomySector.default("tax"),
  dailyStreakBonus: z.number().int().min(0).default(5),
  dailyStreakCap: z.number().int().min(0).default(10),
});

const WorkConfig = z.object({
  workRewardBase: z.number().int().default(120),
  workBaseMintReward: z.number().int().min(0).default(100),
  workBonusFromWorksMax: z.number().int().min(0).default(100),
  workBonusScaleMode: z.enum(["flat", "percent"]).default("flat"),
  workCooldownMinutes: z.number().int().default(30),
  workDailyCap: z.number().int().default(5),
  workCurrencyId: z.string().default("coins"),
  workPaysFromSector: EconomySector.default("works"),
  workFailureChance: z.number().min(0).max(1).default(0.1),
});

const Sectors = z.object({
  global: z.number().default(0),
  works: z.number().default(0),
  trade: z.number().default(0),
  tax: z.number().default(0),
});

export const GuildEconomy = component({
  collection: "guild_economy",
  schema: z.object({
    daily: DailyConfig.default(() => DailyConfig.parse({})),
    work: WorkConfig.default(() => WorkConfig.parse({})),
    sectors: Sectors.default(() => ({ global: 0, works: 0, trade: 0, tax: 0 })),
  }),
});

export type GuildEconomyValue = z.infer<typeof GuildEconomy.schema>;
