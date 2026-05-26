/**
 * Tycoon service — orchestrates the UserFactory component, the coin/scrip
 * wallet, and (in stockpile mode) the RPG stash.
 *
 * Convention: returns `Result` (per CLAUDE.md). Currency mutations throw
 * `MutationError`; we translate those into typed `TycoonError`s here so command
 * code only ever pattern-matches on `result.error.code`.
 *
 * Collect is the one race-sensitive operation (two taps could double-pay), so it
 * is guarded by a per-(user, line) lock — the same pattern quest-claim uses.
 */

import { UserFactory } from "@/components/user-factory";
import { ErrResult, OkResult, type Result } from "@/core/result";
import { adjustBalance, getBalance, MutationError } from "@/features/economy/mutations";
import { addItemsToStash } from "@/features/rpg/inventory";
import type { Ctx } from "@/framework/types";
import {
  eventSeed,
  type LineEvent,
  pendingOutput,
  rollEvent,
  type StageLevels,
  upgradeCost,
} from "./accrual";
import { LINES, type LineId, type StageKind } from "./content/lines";

export class TycoonError extends Error {
  constructor(
    public readonly code:
      | "ALREADY_OWNED"
      | "NOT_OWNED"
      | "INSUFFICIENT_FUNDS"
      | "ALREADY_AUTOMATED"
      | "NOTHING_TO_COLLECT"
      | "STASH_FULL"
      | "BUSY"
      | "NO_SCRIP"
      | "INVALID_AMOUNT",
    message: string,
  ) {
    super(message);
    this.name = "TycoonError";
  }
}

function levelsOf(stages: {
  extractor: { level: number };
  refinery: { level: number };
  assembler: { level: number };
}): StageLevels {
  return {
    extractor: stages.extractor.level,
    refinery: stages.refinery.level,
    assembler: stages.assembler.level,
  };
}

/** Charter (buy) a new production line. Debits its charter cost in coins. */
export async function charter(
  ctx: Ctx,
  userId: string,
  lineId: LineId,
): Promise<Result<{ charterCost: number }, TycoonError>> {
  const def = LINES[lineId];
  const factory = await ctx.ensure(userId, UserFactory);
  if (factory.lines[lineId]) {
    return ErrResult(new TycoonError("ALREADY_OWNED", `You already own ${def.name}.`));
  }

  try {
    await adjustBalance(ctx, userId, "coins", -def.charterCost);
  } catch (err) {
    return ErrResult(toFundsError(err, def.charterCost));
  }

  await ctx.patch(userId, UserFactory, (cur) => ({
    lines: {
      ...cur.lines,
      [lineId]: {
        stages: { extractor: { level: 1 }, refinery: { level: 1 }, assembler: { level: 1 } },
        mode: "sell" as const,
        automated: false,
        lastCollectedAt: Date.now(),
      },
    },
  }));

  return OkResult({ charterCost: def.charterCost });
}

/** Upgrade one stage of an owned line by one level. Debits coins. */
export async function upgrade(
  ctx: Ctx,
  userId: string,
  lineId: LineId,
  stage: StageKind,
): Promise<Result<{ cost: number; newLevel: number }, TycoonError>> {
  const def = LINES[lineId];
  const factory = await ctx.ensure(userId, UserFactory);
  const line = factory.lines[lineId];
  if (!line) return ErrResult(new TycoonError("NOT_OWNED", `You don't own ${def.name} yet.`));

  const currentLevel = line.stages[stage].level;
  const cost = upgradeCost(def.stages[stage], currentLevel);

  try {
    await adjustBalance(ctx, userId, "coins", -cost);
  } catch (err) {
    return ErrResult(toFundsError(err, cost));
  }

  const newLevel = currentLevel + 1;
  await ctx.patch(userId, UserFactory, (cur) => {
    const cl = cur.lines[lineId];
    if (!cl) return {};
    return {
      lines: {
        ...cur.lines,
        [lineId]: { ...cl, stages: { ...cl.stages, [stage]: { level: newLevel } } },
      },
    };
  });

  return OkResult({ cost, newLevel });
}

export interface CollectSummary {
  readonly lineId: LineId;
  readonly mode: "sell" | "stockpile";
  readonly units: number;
  readonly event: LineEvent;
  /** Scrip credited (sell mode). */
  readonly scripGained: number;
  /** Refined material deposited (stockpile mode). */
  readonly materialId: string | null;
  readonly materialsGained: number;
}

/**
 * Collect a single line's pending output. Resets the accrual anchor only when
 * at least one whole unit is produced, so sub-unit progress is never lost.
 */
export async function collect(
  ctx: Ctx,
  userId: string,
  lineId: LineId,
): Promise<Result<CollectSummary, TycoonError>> {
  const lockKey = `tycoon:collect:${userId}:${lineId}`;
  if (!ctx.locks.tryAcquire(lockKey)) {
    return ErrResult(new TycoonError("BUSY", "That line is already being collected. Try again."));
  }
  try {
    const def = LINES[lineId];
    const factory = await ctx.ensure(userId, UserFactory);
    const line = factory.lines[lineId];
    if (!line) return ErrResult(new TycoonError("NOT_OWNED", `You don't own ${def.name} yet.`));

    const now = Date.now();
    const pending = pendingOutput(
      def,
      {
        levels: levelsOf(line.stages),
        mode: line.mode,
        automated: line.automated,
        lastCollectedAt: line.lastCollectedAt,
      },
      now,
    );

    const event = rollEvent(eventSeed(userId, lineId, line.lastCollectedAt));
    const units = Math.floor(pending.units * event.multiplier);

    if (units <= 0) {
      return ErrResult(
        new TycoonError("NOTHING_TO_COLLECT", `${def.name} hasn't produced anything yet.`),
      );
    }

    if (line.mode === "stockpile") {
      const deposit = await addItemsToStash(ctx, userId, { [def.refinedMaterialId]: units });
      if (deposit.isErr()) {
        // Don't reset the anchor — the player keeps the pending output until they make room.
        return ErrResult(new TycoonError("STASH_FULL", deposit.error.message));
      }
      await resetAnchor(ctx, userId, lineId, now, 0);
      return OkResult({
        lineId,
        mode: "stockpile",
        units,
        event,
        scripGained: 0,
        materialId: def.refinedMaterialId,
        materialsGained: units,
      });
    }

    const scrip = units * def.finishedGood.scripValue;
    await resetAnchor(ctx, userId, lineId, now, scrip);
    await adjustBalance(ctx, userId, "scrip", scrip);
    return OkResult({
      lineId,
      mode: "sell",
      units,
      event,
      scripGained: scrip,
      materialId: null,
      materialsGained: 0,
    });
  } finally {
    ctx.locks.release(lockKey);
  }
}

/** Resets a line's accrual anchor and adds to lifetimeScrip in one factory write. */
async function resetAnchor(
  ctx: Ctx,
  userId: string,
  lineId: LineId,
  now: number,
  scripEarned: number,
): Promise<void> {
  await ctx.patch(userId, UserFactory, (cur) => {
    const cl = cur.lines[lineId];
    if (!cl) return {};
    return {
      lines: { ...cur.lines, [lineId]: { ...cl, lastCollectedAt: now } },
      lifetimeScrip: cur.lifetimeScrip + scripEarned,
    };
  });
}

function toFundsError(err: unknown, cost: number): TycoonError {
  if (err instanceof MutationError && err.code === "INSUFFICIENT_FUNDS") {
    return new TycoonError("INSUFFICIENT_FUNDS", `You need ${cost} coins for that.`);
  }
  return new TycoonError("INVALID_AMOUNT", err instanceof Error ? err.message : "Unknown error");
}

/** Reads a user's current scrip balance. */
export function getScrip(ctx: Ctx, userId: string): Promise<number> {
  return getBalance(ctx, userId, "scrip");
}
