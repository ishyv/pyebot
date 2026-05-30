/**
 * Combat Engine.
 *
 * Purpose: Pure functions for deterministic combat calculations and RNG.
 * Implements a seeded combat system where the same seed always produces
 * the same outcomes.
 *
 * Architecture: Stateless pure functions — no side effects, no imports.
 *   All configuration is inlined as COMBAT_CONFIG.
 *
 * Invariants:
 * - Seeded RNG (Mulberry32) ensures reproducible combat sequences.
 * - Minimum 1 damage per successful hit (no zero-damage attacks).
 * - Defense reduces damage; blocks can negate or reduce damage.
 * - Both attacks in a round resolve simultaneously (no first-strike).
 * - Double KO: player with higher HP% wins; p1 wins ties.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const COMBAT_CONFIG = {
  baseMaxHp: 100,
  damageVariance: { min: 0.95, max: 1.25 },
  critMultiplier: { min: 1.5, max: 2.0 },
  critChance: 0.2,
  blockChance: 0.5,
  blockDamageReduction: { min: 0.7, max: 1.0 },
  defenseReduction: { min: 0.5, max: 1.0 },
  minDamage: 1,
  sessionTtlMinutes: 5,
  roundTimeoutSeconds: 60,
  escalationRounds: 10,
  escalationBoostPercent: 2,
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CombatMove = "attack" | "block" | "crit" | "failed_block";

export interface RngState {
  seed: number;
}

export interface CombatRound {
  readonly roundNumber: number;
  readonly p1Move: CombatMove;
  readonly p2Move: CombatMove;
  readonly p1Damage: number;
  readonly p2Damage: number;
  readonly p1Hp: number;
  readonly p2Hp: number;
  readonly seed: number;
}

export interface CombatResult {
  readonly sessionId: string;
  readonly winnerId: string;
  readonly loserId: string;
  readonly totalRounds: number;
  readonly finalHp: { winner: number; loser: number };
  readonly rounds: CombatRound[];
  readonly endedAt: Date;
}

export interface ActiveCombatSession {
  readonly id: string;
  readonly p1Id: string;
  readonly p2Id: string;
  p1Hp: number;
  p2Hp: number;
  readonly p1MaxHp: number;
  readonly p2MaxHp: number;
  readonly p1Atk: number;
  readonly p2Atk: number;
  readonly p1Def: number;
  readonly p2Def: number;
  readonly p1HasShield: boolean;
  readonly p2HasShield: boolean;
  readonly startedAt: Date;
  readonly expiresAt: Date;
  currentRound: number;
  rounds: CombatRound[];
  readonly seed: number;
  status: "pending" | "active" | "completed" | "expired";
  winnerId: string | null;
  pendingMoves: Map<string, CombatMove>;
}

interface DamageCalculationInput {
  readonly attackerAtk: number;
  readonly defenderDef: number;
  readonly attackerMove: CombatMove;
  readonly defenderMove: CombatMove;
  readonly defenderHasShieldItem: boolean;
}

interface DamageCalculationResult {
  readonly damage: number;
  readonly isCrit: boolean;
  readonly isBlocked: boolean;
  readonly isFailedBlock: boolean;
}

// ---------------------------------------------------------------------------
// RNG (Mulberry32)
// ---------------------------------------------------------------------------

/** Create a seeded RNG state. Same seed → identical random sequence. */
export function createRng(seed: number): RngState {
  return { seed: seed >>> 0 };
}

/** Advance RNG and return float in [0, 1). Mutates rng.seed. */
export function nextRandom(rng: RngState): number {
  rng.seed += 0x6d2b79f5;
  let t = rng.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Random integer in inclusive [min, max]. Mutates rng.seed. */
export function nextInt(rng: RngState, min: number, max: number): number {
  return Math.floor(nextRandom(rng) * (max - min + 1)) + min;
}

/** Random float in half-open [min, max). Mutates rng.seed. */
export function nextFloat(rng: RngState, min: number, max: number): number {
  return nextRandom(rng) * (max - min) + min;
}

// ---------------------------------------------------------------------------
// Damage calculation
// ---------------------------------------------------------------------------

/**
 * Calculate damage for a single attack.
 * Mutates rng state.
 */
export function calculateDamage(
  input: DamageCalculationInput,
  rng: RngState,
): DamageCalculationResult {
  const { attackerAtk, defenderDef, attackerMove, defenderMove, defenderHasShieldItem } = input;

  // Blocking attacker deals no damage (defensive stance)
  if (attackerMove === "block") {
    return { damage: 0, isCrit: false, isBlocked: false, isFailedBlock: false };
  }

  // Defender is blocking
  if (defenderMove === "block") {
    const blockSuccess = nextRandom(rng) < COMBAT_CONFIG.blockChance;

    if (blockSuccess && defenderHasShieldItem) {
      // Successful block with shield
      const reduction = nextFloat(
        rng,
        COMBAT_CONFIG.blockDamageReduction.min,
        COMBAT_CONFIG.blockDamageReduction.max,
      );
      const damage = Math.max(COMBAT_CONFIG.minDamage, Math.floor(attackerAtk * (1 - reduction)));
      return { damage, isCrit: false, isBlocked: true, isFailedBlock: false };
    }

    // Failed block or blocking without shield (minimal reduction)
    const damage = Math.max(
      COMBAT_CONFIG.minDamage,
      Math.floor(attackerAtk * 0.95) - Math.floor(defenderDef * 0.05),
    );
    return { damage, isCrit: false, isBlocked: false, isFailedBlock: true };
  }

  // Normal attack vs no block
  const isCrit = nextRandom(rng) < COMBAT_CONFIG.critChance;

  let baseDamage: number;
  if (isCrit) {
    baseDamage =
      nextFloat(rng, COMBAT_CONFIG.critMultiplier.min, COMBAT_CONFIG.critMultiplier.max) *
      attackerAtk;
  } else {
    baseDamage =
      nextFloat(rng, COMBAT_CONFIG.damageVariance.min, COMBAT_CONFIG.damageVariance.max) *
      attackerAtk;
  }

  const defenseReduction =
    nextFloat(rng, COMBAT_CONFIG.defenseReduction.min, COMBAT_CONFIG.defenseReduction.max) *
    defenderDef;
  const damage = Math.max(COMBAT_CONFIG.minDamage, Math.floor(baseDamage - defenseReduction));

  return { damage, isCrit, isBlocked: false, isFailedBlock: false };
}

// ---------------------------------------------------------------------------
// Round resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a single combat round (both players act simultaneously).
 * Pure function — caller must update session state.
 */
export function resolveRound(
  session: ActiveCombatSession,
  p1Move: CombatMove,
  p2Move: CombatMove,
): CombatRound {
  const rng = createRng(session.seed + session.currentRound);

  const p1Attack = calculateDamage(
    {
      attackerAtk: session.p1Atk,
      defenderDef: session.p2Def,
      attackerMove: p1Move,
      defenderMove: p2Move,
      defenderHasShieldItem: session.p2HasShield,
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
    },
    rng,
  );

  const p1Hp = Math.max(0, session.p1Hp - p2Attack.damage);
  const p2Hp = Math.max(0, session.p2Hp - p1Attack.damage);

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

// ---------------------------------------------------------------------------
// Combat state helpers
// ---------------------------------------------------------------------------

/** Returns true if either participant has 0 HP. */
export function isCombatEnded(session: ActiveCombatSession): boolean {
  return session.p1Hp <= 0 || session.p2Hp <= 0;
}

/**
 * Determine the winner from final combat state.
 * Returns null if combat is still in progress.
 * Double KO: player with higher HP% wins; p1 wins ties.
 */
export function determineWinner(session: ActiveCombatSession): string | null {
  if (session.p1Hp <= 0 && session.p2Hp <= 0) {
    const p1Pct = session.p1Hp / session.p1MaxHp;
    const p2Pct = session.p2Hp / session.p2MaxHp;
    return p1Pct >= p2Pct ? session.p1Id : session.p2Id;
  }
  if (session.p1Hp <= 0) return session.p2Id;
  if (session.p2Hp <= 0) return session.p1Id;
  return null;
}

/** Build final CombatResult from a completed session. */
export function buildCombatResult(session: ActiveCombatSession): CombatResult {
  const winnerId = determineWinner(session);
  if (winnerId === null) {
    throw new Error(`buildCombatResult called on incomplete session ${session.id}`);
  }
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

/** Generate a unique combat session ID. */
export function generateSessionId(): string {
  return `combat_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

// ---------------------------------------------------------------------------
// Convenience namespace
// ---------------------------------------------------------------------------

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
