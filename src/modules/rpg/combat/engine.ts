/**
 * Combat Engine.
 *
 * Purpose: Pure functions for combat calculations and RNG.
 * Context: Damage formulas, seeded random, move resolution.
 * Dependencies: None (pure logic).
 *
 * Invariants:
 * - Seeded RNG for reproducibility.
 * - Minimum 1 damage per successful hit.
 * - Defense and block reduce damage.
 */

/**
 * Combat Engine.
 *
 * Purpose: Pure functions for deterministic combat calculations and RNG.
 * Implements a seeded combat system where the same moves always produce
 * the same outcomes given the same seed.
 *
 * Context: Stateless logic module used by the fight service to resolve
 * combat rounds. No side effects - all inputs/outputs are explicit.
 *
 * Dependencies: None (pure logic). Uses COMBAT_CONFIG for constants.
 *
 * Invariants:
 * - Seeded RNG (Mulberry32) ensures reproducible combat sequences.
 * - Minimum 1 damage per successful hit (no zero-damage attacks).
 * - Defense reduces damage; blocks can negate or reduce damage.
 * - Combat ends when either participant reaches 0 HP.
 * - Double KO uses HP percentage tiebreaker (higher % wins).
 *
 * Gotchas:
 * - RNG state mutates (must clone for parallel calculations).
 * - Critical hits bypass normal variance and use critMultiplier range.
 * - Failed blocks (blocking without shield) still reduce damage slightly.
 *
 * RISK: Changing damage formulas affects game balance significantly.
 * RISK: Seed collision possible but unlikely with timestamp+random suffix.
 * ALT: Deterministic seeds from player stats would enable "predictable" combat.
 */
import { COMBAT_CONFIG } from "../config";
import type { CombatMove, CombatRound, CombatResult } from "../types";
import type {
  DamageCalculationInput,
  DamageCalculationResult,
  RngState,
  ActiveCombatSession,
} from "./types";

/**
 * Create a seeded RNG state using Mulberry32 algorithm.
 *
 * Purpose: Deterministic randomness for reproducible combat outcomes.
 *
 * Params:
 * - seed: any integer; will be converted to unsigned 32-bit.
 *
 * Returns: RngState object with mutable seed field.
 *
 * Invariant: Same seed produces identical random sequences.
 *
 * Example:
 * const rng = createRng(12345);
 * const roll1 = nextRandom(rng); // Always same value for seed 12345
 */
export function createRng(seed: number): RngState {
  return { seed: seed >>> 0 };
}

/**
 * Get next random number from RNG state.
 *
 * Purpose: Generate deterministic random values for combat calculations.
 *
 * Side effects: Mutates rng.seed.
 *
 * Returns: Float in range [0, 1).
 *
 * RISK: Do not use for security purposes; Mulberry32 is not cryptographically secure.
 */
export function nextRandom(rng: RngState): number {
  let t = (rng.seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Generate random integer in inclusive range.
 *
 * Params:
 * - rng: mutable RNG state
 * - min: minimum value (inclusive)
 * - max: maximum value (inclusive)
 */
export function nextInt(rng: RngState, min: number, max: number): number {
  return Math.floor(nextRandom(rng) * (max - min + 1)) + min;
}

/**
 * Generate random float in half-open range.
 *
 * Params:
 * - rng: mutable RNG state
 * - min: minimum value (inclusive)
 * - max: maximum value (exclusive)
 */
export function nextFloat(rng: RngState, min: number, max: number): number {
  return nextRandom(rng) * (max - min) + min;
}

/**
 * Calculate damage for a single attack.
 *
 * Purpose: Core combat damage formula incorporating attack, defense,
 * critical hits, blocks, and variance.
 *
 * Params:
 * - input: attacker/defender stats and move choices
 * - rng: mutable RNG state for this calculation
 *
 * Returns: DamageCalculationResult with damage amount and flags.
 *
 * Invariants:
 * - Blocking attackers deal 0 damage (defensive stance).
 * - Successful blocks reduce damage by configured reduction percentage.
 * - Failed blocks (no shield) get minimal 5% reduction.
 * - Critical hits use critMultiplier range instead of normal variance.
 * - Minimum 1 damage guaranteed on successful hits.
 *
 * Side effects: Mutates rng state.
 *
 * RISK: defenderHasShieldItem must be accurate; false positives make blocks too strong.
 * RISK: Changing minDamage affects all combat balance.
 */
export function calculateDamage(
  input: DamageCalculationInput,
  rng: RngState,
): DamageCalculationResult {
  const { attackerAtk, defenderDef, attackerMove, defenderMove, defenderHasShieldItem } = input;

  // If attacker blocks, they deal no damage (defensive stance)
  if (attackerMove === "block") {
    return { damage: 0, isCrit: false, isBlocked: false, isFailedBlock: false };
  }

  // Handle defender block attempt
  if (defenderMove === "block") {
    // WHY: Block success depends on shield ownership + RNG.
    // RISK: blockChance is applied uniformly regardless of shield; shield only affects reduction quality.
    const blockSuccess = nextRandom(rng) < COMBAT_CONFIG.blockChance;

    if (blockSuccess && defenderHasShieldItem) {
      // Successful block with shield
      const reduction = nextFloat(rng, COMBAT_CONFIG.blockDamageReduction.min, COMBAT_CONFIG.blockDamageReduction.max);
      const damage = Math.max(
        COMBAT_CONFIG.minDamage,
        Math.floor(attackerAtk * (1 - reduction)),
      );
      return { damage, isCrit: false, isBlocked: true, isFailedBlock: false };
    }

    // Failed block or blocking without shield (minimal reduction)
    const damage = Math.max(
      COMBAT_CONFIG.minDamage,
      Math.floor(attackerAtk * 0.95) - Math.floor(defenderDef * 0.05),
    );
    return { damage, isCrit: false, isBlocked: false, isFailedBlock: true };
  }

  // Normal Attack vs No Block

  // Determine if critical hit
  const isCrit = nextRandom(rng) < COMBAT_CONFIG.critChance;

  // Calculate base damage
  let baseDamage: number;
  if (isCrit) {
    baseDamage = nextFloat(rng, COMBAT_CONFIG.critMultiplier.min, COMBAT_CONFIG.critMultiplier.max) * attackerAtk;
  } else {
    baseDamage = nextFloat(rng, COMBAT_CONFIG.damageVariance.min, COMBAT_CONFIG.damageVariance.max) * attackerAtk;
  }

  // Apply defense reduction
  const defenseReduction = nextFloat(rng, COMBAT_CONFIG.defenseReduction.min, COMBAT_CONFIG.defenseReduction.max) * defenderDef;
  const damage = Math.max(COMBAT_CONFIG.minDamage, Math.floor(baseDamage - defenseReduction));

  return { damage, isCrit, isBlocked: false, isFailedBlock: false };
}

  // Determine if critical hit
  const isCrit = nextRandom(rng) < COMBAT_CONFIG.critChance;

  // Calculate base damage
  let baseDamage: number;
  if (isCrit) {
    baseDamage = nextFloat(rng, COMBAT_CONFIG.critMultiplier.min, COMBAT_CONFIG.critMultiplier.max) * attackerAtk;
  } else {
    baseDamage = nextFloat(rng, COMBAT_CONFIG.damageVariance.min, COMBAT_CONFIG.damageVariance.max) * attackerAtk;
  }

  // Apply defense reduction
  const defenseReduction = nextFloat(rng, COMBAT_CONFIG.defenseReduction.min, COMBAT_CONFIG.defenseReduction.max) * defenderDef;
  const damage = Math.max(COMBAT_CONFIG.minDamage, Math.floor(baseDamage - defenseReduction));

  return { damage, isCrit, isBlocked: false, isFailedBlock: false };
}

/**
 * Resolve a single combat round (both players act simultaneously).
 *
 * Purpose: Process both players' moves and compute resulting HP changes.
 *
 * Params:
 * - session: current combat state including HP, stats, and round counter
 * - p1Move: player 1's chosen move (attack/block)
 * - p2Move: player 2's chosen move (attack/block)
 *
 * Returns: CombatRound with damage dealt, HP after, and effective moves.
 *
 * Invariants:
 * - Both attacks resolve simultaneously (no first-strike advantage).
 * - Seed is derived from session.seed + round number for determinism.
 * - HP cannot go below 0.
 * - Effective moves reflect actual outcome (crit/failed_block vs chosen).
 *
 * Side effects: None (pure function; caller must update session state).
 *
 * RISK: Session seed collision between rounds would produce identical outcomes.
 * RISK: HP must be clamped to 0; negative HP breaks winner determination.
 */
export function resolveRound(
  session: ActiveCombatSession,
  p1Move: CombatMove,
  p2Move: CombatMove,
): CombatRound {
  const rng = createRng(session.seed + session.currentRound);

  // Calculate both damages simultaneously
  const p1Attack = calculateDamage(
    {
      attackerAtk: session.p1Atk,
      defenderDef: session.p2Def,
      attackerMove: p1Move,
      defenderMove: p2Move,
      defenderHasShieldItem: session.p2HasShield,
      seedOffset: session.currentRound * 2,
    },
    rng,
  );

  const p2Attack = calculateDamage(
    {
      attackerAtk: session.p2Atk,
      defenderDef: session.p1Def,
      attackerMove: p2Move,
      defenderMove: p1Move,
      defenderHasShieldItem: session.p1HasShield,
      seedOffset: session.currentRound * 2 + 1,
    },
    rng,
  );

  // Apply damage simultaneously
  const p1Hp = Math.max(0, session.p1Hp - p2Attack.damage);
  const p2Hp = Math.max(0, session.p2Hp - p1Attack.damage);

  // Determine effective moves (crit, failed_block, etc.)
  const p1EffectiveMove: CombatMove = p1Attack.isCrit
    ? "crit"
    : p1Attack.isFailedBlock
      ? "failed_block"
      : p1Move;

  const p2EffectiveMove: CombatMove = p2Attack.isCrit
    ? "crit"
    : p2Attack.isFailedBlock
      ? "failed_block"
      : p2Move;

  return {
    roundNumber: session.currentRound,
    p1Move: p1EffectiveMove,
    p2Move: p2EffectiveMove,
    p1Damage: p2Attack.damage,
    p2Damage: p1Attack.damage,
    p1Hp,
    p2Hp,
    seed: session.seed + session.currentRound,
  };
}

/**
 * Check if combat has ended.
 *
 * Purpose: Determine termination condition for combat loop.
 *
 * Invariant: Returns true if either participant has 0 or less HP.
 */
export function isCombatEnded(session: ActiveCombatSession): boolean {
  return session.p1Hp <= 0 || session.p2Hp <= 0;
}

/**
 * Determine the winner of a completed combat.
 *
 * Purpose: Resolve winner from final combat state.
 *
 * Returns:
 * - winner's userId if decisive
 * - player with higher HP% on double KO (p1 wins ties)
 * - null if combat hasn't ended (should not happen)
 *
 * RISK: Double KO logic must match UX expectations; ties going to p1 is arbitrary.
 */
export function determineWinner(session: ActiveCombatSession): string | null {
  if (session.p1Hp <= 0 && session.p2Hp <= 0) {
    // Double KO - player with higher HP percentage wins (or p1 if tied)
    const p1HpPercent = session.p1Hp / session.p1MaxHp;
    const p2HpPercent = session.p2Hp / session.p2MaxHp;
    return p1HpPercent >= p2HpPercent ? session.p1Id : session.p2Id;
  }
  if (session.p1Hp <= 0) return session.p2Id;
  if (session.p2Hp <= 0) return session.p1Id;
  return null;
}

/**
 * Build final combat result from completed session.
 *
 * Purpose: Package combat outcome for persistence and display.
 *
 * Precondition: Combat must be ended (isCombatEnded returns true).
 *
 * Returns: CombatResult with winner, loser, rounds, and final HP.
 *
 * RISK: Caller must ensure combat is complete; undefined behavior if called early.
 */
export function buildCombatResult(
  session: ActiveCombatSession,
): CombatResult {
  const winnerId = determineWinner(session)!;
  const loserId = winnerId === session.p1Id ? session.p2Id : session.p1Id;

  return {
    sessionId: session.id,
    winnerId,
    loserId,
    totalRounds: session.currentRound,
    finalHp: {
      winner: winnerId === session.p1Id ? session.p1Hp : session.p2Hp,
      loser: winnerId === session.p1Id ? session.p2Hp : session.p1Hp,
    },
    rounds: session.rounds,
    endedAt: new Date(),
  };
}

/**
 * Generate unique combat session ID.
 *
 * Purpose: Create collision-resistant identifiers for fights.
 *
 * Format: combat_{timestamp}_{randomSuffix}
 *
 * RISK: Not cryptographically random; suitable for non-security use only.
 */
export function generateSessionId(): string {
  return `combat_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/** Combat Engine namespace. */
export const CombatEngine = {
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
} as const;
