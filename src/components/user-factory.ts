/**
 * UserFactory — a user's automated production lines (the tycoon layer).
 *
 * Each line is a chain of three stages (extractor → refinery → assembler).
 * Income accrues *lazily*: nothing ticks in the background. Pending output is
 * computed from `lastCollectedAt` whenever the player opens `/tycoon` or
 * collects. This is why the feature needs no scheduler and survives restarts.
 *
 * `lifetimeScrip` is monotonic (never decremented by the Exchange) so it can
 * back the Magnate leaderboard without being eroded by spending.
 */

import { z } from "zod";
import { User } from "@/components/entities";
import { defineComponent } from "@/framework";

const StageState = z.object({
  level: z.number().int().min(1).catch(1).default(1),
});

const LineState = z.object({
  stages: z
    .object({
      extractor: StageState.default({ level: 1 }),
      refinery: StageState.default({ level: 1 }),
      assembler: StageState.default({ level: 1 }),
    })
    .default({ extractor: { level: 1 }, refinery: { level: 1 }, assembler: { level: 1 } }),
  /** "sell" auto-sells finished goods for scrip; "stockpile" deposits refined material into the stash. */
  mode: z.enum(["sell", "stockpile"]).catch("sell").default("sell"),
  /** Automation module (the "manager") — removes the offline storage cap. */
  automated: z.boolean().catch(false).default(false),
  /** Epoch ms of the last collect; the lazy-accrual anchor. */
  lastCollectedAt: z.number().int().nonnegative().catch(0).default(0),
});

export const UserFactory = defineComponent(
  User,
  "factory",
  z.object({
    lines: z.record(z.string(), LineState).default({}),
    lifetimeScrip: z.number().int().nonnegative().catch(0).default(0),
  }),
);

export type UserFactoryValue = z.infer<typeof UserFactory.schema>;
export type LineState = z.infer<typeof LineState>;
export type StageState = z.infer<typeof StageState>;
