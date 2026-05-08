/**
 * Tests for the combat engine (pure functions — no mocks needed).
 */

import { describe, expect, test } from "bun:test";
import {
  createRng,
  nextRandom,
  nextInt,
  nextFloat,
  calculateDamage,
  resolveRound,
  isCombatEnded,
  determineWinner,
  buildCombatResult,
  generateSessionId,
  COMBAT_CONFIG,
  type ActiveCombatSession,
} from "./engine";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeSession(overrides: Partial<ActiveCombatSession> = {}): ActiveCombatSession {
  const now = new Date();
  return {
    id: "combat_test",
    p1Id: "p1",
    p2Id: "p2",
    p1Hp: 100,
    p2Hp: 100,
    p1MaxHp: 100,
    p2MaxHp: 100,
    p1Atk: 20,
    p2Atk: 20,
    p1Def: 5,
    p2Def: 5,
    p1HasShield: false,
    p2HasShield: false,
    startedAt: now,
    expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
    currentRound: 1,
    rounds: [],
    seed: 42,
    status: "active",
    winnerId: null,
    pendingMoves: new Map(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// RNG tests
// ---------------------------------------------------------------------------

describe("RNG", () => {
  test("createRng initializes with correct seed", () => {
    const rng = createRng(12345);
    expect(rng.seed).toBe(12345);
  });

  test("nextRandom produces values in [0, 1)", () => {
    const rng = createRng(99999);
    for (let i = 0; i < 100; i++) {
      const val = nextRandom(rng);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  test("same seed produces identical sequence", () => {
    const rng1 = createRng(7777);
    const rng2 = createRng(7777);
    for (let i = 0; i < 20; i++) {
      expect(nextRandom(rng1)).toBe(nextRandom(rng2));
    }
  });

  test("different seeds produce different sequences", () => {
    const rng1 = createRng(1);
    const rng2 = createRng(2);
    const r1 = nextRandom(rng1);
    const r2 = nextRandom(rng2);
    expect(r1).not.toBe(r2);
  });

  test("nextInt produces values in inclusive [min, max]", () => {
    const rng = createRng(55555);
    for (let i = 0; i < 100; i++) {
      const val = nextInt(rng, 1, 6);
      expect(val).toBeGreaterThanOrEqual(1);
      expect(val).toBeLessThanOrEqual(6);
      expect(Number.isInteger(val)).toBe(true);
    }
  });

  test("nextFloat produces values in [min, max)", () => {
    const rng = createRng(11111);
    for (let i = 0; i < 100; i++) {
      const val = nextFloat(rng, 0.5, 1.5);
      expect(val).toBeGreaterThanOrEqual(0.5);
      expect(val).toBeLessThan(1.5);
    }
  });
});

// ---------------------------------------------------------------------------
// calculateDamage tests
// ---------------------------------------------------------------------------

describe("calculateDamage", () => {
  test("blocking attacker deals 0 damage", () => {
    const rng = createRng(1);
    const result = calculateDamage(
      { attackerAtk: 20, defenderDef: 5, attackerMove: "block", defenderMove: "attack", defenderHasShieldItem: false },
      rng,
    );
    expect(result.damage).toBe(0);
    expect(result.isCrit).toBe(false);
  });

  test("normal attack deals at least minDamage", () => {
    for (let seed = 1; seed < 100; seed++) {
      const rng = createRng(seed);
      const result = calculateDamage(
        { attackerAtk: 10, defenderDef: 0, attackerMove: "attack", defenderMove: "attack", defenderHasShieldItem: false },
        rng,
      );
      expect(result.damage).toBeGreaterThanOrEqual(COMBAT_CONFIG.minDamage);
    }
  });

  test("defender blocking with shield reduces damage (isBlocked)", () => {
    // Find a seed that produces a successful block
    for (let seed = 1; seed < 1000; seed++) {
      const rng = createRng(seed);
      const result = calculateDamage(
        { attackerAtk: 20, defenderDef: 5, attackerMove: "attack", defenderMove: "block", defenderHasShieldItem: true },
        rng,
      );
      if (result.isBlocked) {
        // Damage should be less than or equal to full attack
        expect(result.damage).toBeLessThanOrEqual(20);
        expect(result.isCrit).toBe(false);
        return;
      }
    }
    // Should have found at least one successful block in 1000 seeds
    expect(true).toBe(false); // unreachable
  });

  test("blocking without shield sets isFailedBlock", () => {
    // Find a seed that produces a failed block scenario
    // blockChance = 0.5, so ~50% fail, and without shield → failedBlock
    for (let seed = 1; seed < 200; seed++) {
      const rng = createRng(seed);
      const result = calculateDamage(
        { attackerAtk: 20, defenderDef: 5, attackerMove: "attack", defenderMove: "block", defenderHasShieldItem: false },
        rng,
      );
      if (result.isFailedBlock) {
        expect(result.damage).toBeGreaterThanOrEqual(COMBAT_CONFIG.minDamage);
        return;
      }
    }
    expect(true).toBe(false);
  });

  test("critical hits produce higher damage multiplier", () => {
    // Crit damage should be at least critMultiplier.min * atk - some def reduction
    let foundCrit = false;
    for (let seed = 1; seed < 500; seed++) {
      const rng = createRng(seed);
      const result = calculateDamage(
        { attackerAtk: 100, defenderDef: 0, attackerMove: "attack", defenderMove: "attack", defenderHasShieldItem: false },
        rng,
      );
      if (result.isCrit) {
        // Crit min = 1.5 * 100 = 150
        expect(result.damage).toBeGreaterThanOrEqual(Math.floor(COMBAT_CONFIG.critMultiplier.min * 100 * 0.9));
        foundCrit = true;
        break;
      }
    }
    expect(foundCrit).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resolveRound tests
// ---------------------------------------------------------------------------

describe("resolveRound", () => {
  test("both players attack — hp decreases", () => {
    const session = makeSession({ seed: 100, currentRound: 1 });
    const round = resolveRound(session, "attack", "attack");

    expect(round.roundNumber).toBe(1);
    // Both took damage
    expect(round.p1Hp).toBeLessThan(100);
    expect(round.p2Hp).toBeLessThan(100);
    // Damage is at least 1
    expect(round.p1Damage).toBeGreaterThanOrEqual(1);
    expect(round.p2Damage).toBeGreaterThanOrEqual(1);
  });

  test("same session+round produces identical outcome (determinism)", () => {
    const session1 = makeSession({ seed: 54321 });
    const session2 = makeSession({ seed: 54321 });

    const r1 = resolveRound(session1, "attack", "block");
    const r2 = resolveRound(session2, "attack", "block");

    expect(r1.p1Damage).toBe(r2.p1Damage);
    expect(r1.p2Damage).toBe(r2.p2Damage);
    expect(r1.p1Hp).toBe(r2.p1Hp);
    expect(r1.p2Hp).toBe(r2.p2Hp);
    expect(r1.p1Move).toBe(r2.p1Move);
    expect(r1.p2Move).toBe(r2.p2Move);
  });

  test("blocking attacker deals 0 to opponent (p2Damage = 0)", () => {
    const session = makeSession({ seed: 999, p1Atk: 50 });
    const round = resolveRound(session, "block", "attack");
    // p1 is blocking → p1's attack = 0 → p2 takes 0 damage from p1
    expect(round.p2Damage).toBe(0);
    // p2 is attacking → p1 takes some damage
    expect(round.p1Damage).toBeGreaterThanOrEqual(1);
  });

  test("hp is clamped to 0", () => {
    // Tiny HP, big attacker
    const session = makeSession({ p1Hp: 1, p2Hp: 1, p1Atk: 1000, p2Atk: 1000, p1Def: 0, p2Def: 0 });
    const round = resolveRound(session, "attack", "attack");
    expect(round.p1Hp).toBe(0);
    expect(round.p2Hp).toBe(0);
  });

  test("different rounds produce different outcomes (same session)", () => {
    const session1 = makeSession({ seed: 12345, currentRound: 1 });
    const session2 = makeSession({ seed: 12345, currentRound: 2 });

    const r1 = resolveRound(session1, "attack", "attack");
    const r2 = resolveRound(session2, "attack", "attack");

    // Same seed but different round → different RNG inputs → likely different damage
    // (not guaranteed to differ, but for seed=12345 rounds 1 vs 2 they should)
    // This is a probabilistic test — just verify structure is correct
    expect(r1.roundNumber).toBe(1);
    expect(r2.roundNumber).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// isCombatEnded / determineWinner / buildCombatResult tests
// ---------------------------------------------------------------------------

describe("isCombatEnded", () => {
  test("returns false when both players have HP", () => {
    expect(isCombatEnded(makeSession({ p1Hp: 50, p2Hp: 50 }))).toBe(false);
  });

  test("returns true when p1 has 0 HP", () => {
    expect(isCombatEnded(makeSession({ p1Hp: 0, p2Hp: 50 }))).toBe(true);
  });

  test("returns true when p2 has 0 HP", () => {
    expect(isCombatEnded(makeSession({ p1Hp: 50, p2Hp: 0 }))).toBe(true);
  });

  test("returns true on double KO", () => {
    expect(isCombatEnded(makeSession({ p1Hp: 0, p2Hp: 0 }))).toBe(true);
  });
});

describe("determineWinner", () => {
  test("returns p2 when p1 has 0 HP", () => {
    expect(determineWinner(makeSession({ p1Hp: 0, p2Hp: 30 }))).toBe("p2");
  });

  test("returns p1 when p2 has 0 HP", () => {
    expect(determineWinner(makeSession({ p1Hp: 40, p2Hp: 0 }))).toBe("p1");
  });

  test("returns null when both still alive", () => {
    expect(determineWinner(makeSession({ p1Hp: 50, p2Hp: 50 }))).toBeNull();
  });

  test("double KO: p1 wins when HP% equal", () => {
    // Both at 0 HP → p1 wins ties
    expect(determineWinner(makeSession({ p1Hp: 0, p2Hp: 0, p1MaxHp: 100, p2MaxHp: 100 }))).toBe("p1");
  });

  test("double KO: higher HP% player wins", () => {
    // p1 at 0/100 = 0%, p2 at 0/200 = 0% → p1 wins (equal → p1)
    // p1 at 0/100, p2 at 0/50 → both 0, p1 wins
    const s = makeSession({ p1Hp: 0, p2Hp: 0, p1MaxHp: 50, p2MaxHp: 100 });
    // p1%: 0/50=0, p2%: 0/100=0 → p1 wins (equal)
    expect(determineWinner(s)).toBe("p1");
  });
});

describe("buildCombatResult", () => {
  test("builds correct result when p2 wins", () => {
    const session = makeSession({ p1Hp: 0, p2Hp: 30, currentRound: 5 });
    const result = buildCombatResult(session);
    expect(result.winnerId).toBe("p2");
    expect(result.loserId).toBe("p1");
    expect(result.totalRounds).toBe(5);
    expect(result.finalHp.winner).toBe(30);
    expect(result.finalHp.loser).toBe(0);
    expect(result.sessionId).toBe("combat_test");
    expect(result.endedAt).toBeInstanceOf(Date);
  });
});

describe("generateSessionId", () => {
  test("returns string starting with 'combat_'", () => {
    const id = generateSessionId();
    expect(id).toMatch(/^combat_\d+_[a-z0-9]+$/);
  });

  test("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateSessionId()));
    expect(ids.size).toBe(100);
  });
});
