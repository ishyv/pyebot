/**
 * Pure tycoon math — no Discord, no DB, no clock of its own (callers pass `now`).
 *
 * The whole idle layer rests on these functions. A line's throughput is the
 * MINIMUM rate across its active stages (the bottleneck) — that single `min()`
 * is what turns "buy upgrades" into "balance your factory". Output accrues
 * lazily: `producedUnits ≈ throughput × effectiveHours`, where the offline cap
 * limits `effectiveHours` unless the line is automated.
 */

import { createRng, nextRandom } from "@/features/rpg/combat/engine";
import { activeStagesForMode, type LineDef, type StageDef, type StageKind } from "./content/lines";

const MS_PER_HOUR = 3_600_000;

/** Output doubles every `milestoneEvery` levels. Level 1 → ×1. */
export function milestoneMult(level: number, milestoneEvery: number): number {
  return 2 ** Math.floor((level - 1) / milestoneEvery);
}

/** A stage's units/hour at a given level (linear in level, doubled at milestones). */
export function stageRate(stage: StageDef, level: number, milestoneEvery: number): number {
  return stage.baseRate * level * milestoneMult(level, milestoneEvery);
}

/** Coins to upgrade a stage from `currentLevel` to `currentLevel + 1`. */
export function upgradeCost(stage: StageDef, currentLevel: number): number {
  return Math.round(stage.baseUpgradeCost * stage.upgradeCostMult ** (currentLevel - 1));
}

export interface StageLevels {
  readonly extractor: number;
  readonly refinery: number;
  readonly assembler: number;
}

export interface ThroughputResult {
  /** Units/hour of the finished/refined good — limited by the slowest active stage. */
  readonly rate: number;
  /** The stage that limits the line (the one worth upgrading). */
  readonly bottleneck: StageKind;
  /** Per-stage rates, for display. */
  readonly stageRates: Readonly<Record<StageKind, number>>;
}

/** Throughput of a line in a given mode = min rate over its active stages. */
export function lineThroughput(
  def: LineDef,
  levels: StageLevels,
  mode: "sell" | "stockpile",
): ThroughputResult {
  const stageRates: Record<StageKind, number> = {
    extractor: stageRate(def.stages.extractor, levels.extractor, def.milestoneEvery),
    refinery: stageRate(def.stages.refinery, levels.refinery, def.milestoneEvery),
    assembler: stageRate(def.stages.assembler, levels.assembler, def.milestoneEvery),
  };

  const active = activeStagesForMode(mode);
  let bottleneck = active[0];
  let rate = stageRates[bottleneck];
  for (const kind of active) {
    if (stageRates[kind] < rate) {
      rate = stageRates[kind];
      bottleneck = kind;
    }
  }
  return { rate, bottleneck, stageRates };
}

export interface PendingInput {
  readonly levels: StageLevels;
  readonly mode: "sell" | "stockpile";
  readonly automated: boolean;
  readonly lastCollectedAt: number;
}

export interface PendingResult {
  /** Whole units produced since last collect (before event multiplier). */
  readonly units: number;
  readonly throughput: ThroughputResult;
  /** Hours actually counted (capped unless automated). */
  readonly effectiveHours: number;
  /** True when the offline cap clipped the elapsed time (manual lines only). */
  readonly capped: boolean;
}

/**
 * Lazy accrual. Returns whole units produced between `lastCollectedAt` and `now`.
 * Without automation, elapsed time is clamped to `capHours` (the offline cap).
 */
export function pendingOutput(def: LineDef, state: PendingInput, now: number): PendingResult {
  const throughput = lineThroughput(def, state.levels, state.mode);
  const elapsedHours = Math.max(0, (now - state.lastCollectedAt) / MS_PER_HOUR);
  const effectiveHours = state.automated ? elapsedHours : Math.min(elapsedHours, def.capHours);
  const units = Math.floor(throughput.rate * effectiveHours);
  return {
    units,
    throughput,
    effectiveHours,
    capped: !state.automated && elapsedHours > def.capHours,
  };
}

// ---------------------------------------------------------------------------
// Collect-time random events (lazy, seeded → deterministic & auditable)
// ---------------------------------------------------------------------------

export interface LineEvent {
  readonly id: string;
  readonly label: string;
  /** Multiplier applied to produced units this collect (1 = no change). */
  readonly multiplier: number;
}

interface EventDef extends LineEvent {
  readonly weight: number;
}

const EVENTS: readonly EventDef[] = [
  { id: "none", label: "", multiplier: 1, weight: 60 },
  { id: "rich_vein", label: "⚜️ Rich Vein — output +40%!", multiplier: 1.4, weight: 12 },
  { id: "surplus_order", label: "📦 Surplus Order — output +25%!", multiplier: 1.25, weight: 13 },
  { id: "cave_in", label: "🪨 Cave-in — output −30%.", multiplier: 0.7, weight: 8 },
  { id: "guild_audit", label: "📋 Guild Audit — output −15%.", multiplier: 0.85, weight: 7 },
];

/** Deterministic 32-bit hash of a string, for building stable per-collect seeds. */
export function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Build a stable seed for a collect: same (user, line, collect-anchor) → same event. */
export function eventSeed(userId: string, lineId: string, anchorMs: number): number {
  return (hashString(`${userId}:${lineId}`) ^ (anchorMs >>> 0)) >>> 0;
}

/** Roll a collect-time event from a seed. Same seed always yields the same event. */
export function rollEvent(seed: number): LineEvent {
  const rng = createRng(seed);
  const total = EVENTS.reduce((sum, e) => sum + e.weight, 0);
  let roll = nextRandom(rng) * total;
  for (const e of EVENTS) {
    roll -= e.weight;
    if (roll < 0) return { id: e.id, label: e.label, multiplier: e.multiplier };
  }
  return EVENTS[0];
}
