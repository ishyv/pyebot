/**
 * Tests for the pure tycoon math (no mocks — deterministic functions).
 */

import { describe, expect, test } from "bun:test";
import {
  eventSeed,
  hashString,
  lineThroughput,
  milestoneMult,
  pendingOutput,
  rollEvent,
  stageRate,
  upgradeCost,
} from "./accrual";
import { LINES } from "./content/lines";

const IRON = LINES.iron_works;
const MS_PER_HOUR = 3_600_000;

describe("milestoneMult", () => {
  test("level 1 has no multiplier", () => {
    expect(milestoneMult(1, 25)).toBe(1);
  });

  test("doubles at each milestone boundary", () => {
    expect(milestoneMult(25, 25)).toBe(1); // levels 1..25 are the first band
    expect(milestoneMult(26, 25)).toBe(2);
    expect(milestoneMult(51, 25)).toBe(4);
  });
});

describe("stageRate", () => {
  test("scales linearly with level inside a milestone band", () => {
    const s = IRON.stages.extractor;
    expect(stageRate(s, 2, IRON.milestoneEvery)).toBe(s.baseRate * 2);
  });

  test("milestone doubling stacks on the linear growth", () => {
    const s = IRON.stages.extractor;
    const justPast = IRON.milestoneEvery + 1;
    expect(stageRate(s, justPast, IRON.milestoneEvery)).toBe(s.baseRate * justPast * 2);
  });
});

describe("upgradeCost", () => {
  test("first upgrade equals the base cost", () => {
    expect(upgradeCost(IRON.stages.extractor, 1)).toBe(IRON.stages.extractor.baseUpgradeCost);
  });

  test("grows geometrically", () => {
    const s = IRON.stages.extractor;
    expect(upgradeCost(s, 3)).toBe(Math.round(s.baseUpgradeCost * s.upgradeCostMult ** 2));
  });
});

describe("lineThroughput", () => {
  test("is limited by the slowest active stage (the bottleneck)", () => {
    const levels = { extractor: 1, refinery: 5, assembler: 5 };
    const t = lineThroughput(IRON, levels, "sell");
    expect(t.bottleneck).toBe("extractor");
    expect(t.rate).toBe(stageRate(IRON.stages.extractor, 1, IRON.milestoneEvery));
  });

  test("stockpile mode ignores the assembler", () => {
    // Assembler is level 1 (slowest), but stockpile mode doesn't run it.
    const levels = { extractor: 10, refinery: 10, assembler: 1 };
    const sell = lineThroughput(IRON, levels, "sell");
    const stock = lineThroughput(IRON, levels, "stockpile");
    expect(sell.bottleneck).toBe("assembler");
    expect(stock.bottleneck).not.toBe("assembler");
    expect(stock.rate).toBeGreaterThan(sell.rate);
  });
});

describe("pendingOutput", () => {
  const base = { levels: { extractor: 1, refinery: 1, assembler: 1 }, mode: "sell" as const };

  test("accrues throughput × elapsed hours", () => {
    const now = 10 * MS_PER_HOUR;
    const r = pendingOutput(
      IRON,
      { ...base, automated: false, lastCollectedAt: 9 * MS_PER_HOUR },
      now,
    );
    expect(r.units).toBe(Math.floor(r.throughput.rate * 1));
    expect(r.capped).toBe(false);
  });

  test("offline cap clamps elapsed time for manual lines", () => {
    const now = (IRON.capHours + 100) * MS_PER_HOUR;
    const r = pendingOutput(IRON, { ...base, automated: false, lastCollectedAt: 0 }, now);
    expect(r.effectiveHours).toBe(IRON.capHours);
    expect(r.capped).toBe(true);
  });

  test("automation removes the cap", () => {
    const now = (IRON.capHours + 100) * MS_PER_HOUR;
    const r = pendingOutput(IRON, { ...base, automated: true, lastCollectedAt: 0 }, now);
    expect(r.effectiveHours).toBeCloseTo(IRON.capHours + 100);
    expect(r.capped).toBe(false);
  });

  test("never goes negative when clocks disagree", () => {
    const r = pendingOutput(IRON, { ...base, automated: false, lastCollectedAt: 1000 }, 0);
    expect(r.units).toBe(0);
  });
});

describe("rollEvent", () => {
  test("is deterministic for a given seed", () => {
    const seed = eventSeed("user-123", "iron_works", 42_000);
    expect(rollEvent(seed)).toEqual(rollEvent(seed));
  });

  test("multipliers stay within the configured band", () => {
    for (let i = 0; i < 200; i++) {
      const e = rollEvent(hashString(`seed-${i}`));
      expect(e.multiplier).toBeGreaterThanOrEqual(0.7);
      expect(e.multiplier).toBeLessThanOrEqual(1.4);
    }
  });

  test("different collect anchors can produce different events", () => {
    const seeds = Array.from({ length: 50 }, (_, i) => eventSeed("u", "iron_works", i * 1000));
    const ids = new Set(seeds.map((s) => rollEvent(s).id));
    expect(ids.size).toBeGreaterThan(1);
  });
});
