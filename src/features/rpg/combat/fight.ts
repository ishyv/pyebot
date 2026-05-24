/**
 * Fight orchestration service.
 *
 * Architecture: Plain exported async functions — no classes (except FightError).
 * Dependencies: engine (pure combat), sessions + locks from core/state,
 *   component-backed RPG profile helpers.
 *
 * Flow:
 *   initiateFight → session status = "pending"
 *   acceptFight   → session status = "active"
 *   submitMove    → resolves round when both players have moved;
 *                   ends combat when isCombatEnded; updates profiles
 *   forfeit       → ends combat immediately, forfeiter loses
 *
 * NOTE: Rewards (XP, currency) are not applied here — they are the caller's
 * responsibility after receiving a CombatResult.
 */

import { ErrResult, OkResult, type Result } from "@/core/result";
import { locks, sessions } from "@/core/state";
import { ensureRpgProfile, patchRpgProfile } from "@/features/rpg/profile";
import type { Ctx } from "@/framework/types";
import {
  type ActiveCombatSession,
  COMBAT_CONFIG,
  CombatEngine,
  type CombatMove,
  type CombatResult,
  generateSessionId,
} from "./engine";

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class FightError extends Error {
  constructor(
    public readonly code:
      | "SELF_COMBAT"
      | "PROFILE_NOT_FOUND"
      | "IN_COMBAT"
      | "SESSION_NOT_FOUND"
      | "SESSION_EXPIRED"
      | "NOT_YOUR_FIGHT"
      | "ALREADY_MOVED"
      | "SESSION_NOT_ACTIVE"
      | "FIGHT_LOCKED"
      | "UPDATE_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "FightError";
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FightStats {
  readonly atk: number;
  readonly def: number;
  readonly maxHp: number;
}

export interface InitiateFightOptions {
  /** Override stats (e.g. from loadout). If omitted, defaults to base stats. */
  readonly p1Stats?: Partial<FightStats>;
  readonly p2Stats?: Partial<FightStats>;
}

export interface InitiateFightResult {
  readonly sessionId: string;
  readonly inviterId: string;
  readonly targetId: string;
  readonly expiresAt: Date;
}

export interface AcceptFightResult {
  readonly sessionId: string;
  readonly p1Id: string;
  readonly p2Id: string;
}

export interface SubmitMoveResult {
  readonly roundResolved: boolean;
  readonly combatEnded: boolean;
  readonly round?: ReturnType<typeof CombatEngine.resolveRound>;
  readonly combatResult?: CombatResult;
}

const SESSION_PREFIX = "fight:";
function sessionKey(id: string): string {
  return `${SESSION_PREFIX}${id}`;
}

function getSession(sessionId: string): ActiveCombatSession | null {
  return (sessions.get(sessionKey(sessionId)) as ActiveCombatSession) ?? null;
}

function saveSession(session: ActiveCombatSession): void {
  sessions.set(sessionKey(session.id), session);
}

function deleteSession(sessionId: string): void {
  sessions.delete(sessionKey(sessionId));
}

function defaultStats(override?: Partial<FightStats>): FightStats {
  return {
    atk: override?.atk ?? 10,
    def: override?.def ?? 5,
    maxHp: override?.maxHp ?? COMBAT_CONFIG.baseMaxHp,
  };
}

// ---------------------------------------------------------------------------
// initiateFight
// ---------------------------------------------------------------------------

export async function initiateFight(
  ctx: Ctx,
  inviterId: string,
  targetId: string,
  options: InitiateFightOptions = {},
): Promise<Result<InitiateFightResult, FightError>> {
  if (inviterId === targetId) {
    return ErrResult(new FightError("SELF_COMBAT", "You cannot fight yourself"));
  }

  let p1Profile: Awaited<ReturnType<typeof ensureRpgProfile>>;
  let p2Profile: Awaited<ReturnType<typeof ensureRpgProfile>>;
  try {
    [p1Profile, p2Profile] = await Promise.all([
      ensureRpgProfile(ctx, inviterId),
      ensureRpgProfile(ctx, targetId),
    ]);
  } catch {
    return ErrResult(new FightError("PROFILE_NOT_FOUND", "RPG profile not found"));
  }

  if (p1Profile.isFighting)
    return ErrResult(new FightError("IN_COMBAT", "You are already in combat"));
  if (p2Profile.isFighting)
    return ErrResult(new FightError("IN_COMBAT", "Target is already in combat"));

  const p1Stats = defaultStats(options.p1Stats);
  const p2Stats = defaultStats(options.p2Stats);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + COMBAT_CONFIG.sessionTtlMinutes * 60 * 1000);
  const sessionId = generateSessionId();
  const seed = Math.floor(Math.random() * 0xffffffff);

  const session: ActiveCombatSession = {
    id: sessionId,
    p1Id: inviterId,
    p2Id: targetId,
    p1Hp: p1Stats.maxHp,
    p2Hp: p2Stats.maxHp,
    p1MaxHp: p1Stats.maxHp,
    p2MaxHp: p2Stats.maxHp,
    p1Atk: p1Stats.atk,
    p2Atk: p2Stats.atk,
    p1Def: p1Stats.def,
    p2Def: p2Stats.def,
    p1HasShield: !!p1Profile.loadout.shield,
    p2HasShield: !!p2Profile.loadout.shield,
    startedAt: now,
    expiresAt,
    currentRound: 1,
    rounds: [],
    seed,
    status: "pending",
    winnerId: null,
    pendingMoves: new Map(),
  };

  saveSession(session);

  return OkResult({ sessionId, inviterId, targetId, expiresAt });
}

// ---------------------------------------------------------------------------
// acceptFight
// ---------------------------------------------------------------------------

export async function acceptFight(
  ctx: Ctx,
  sessionId: string,
  accepterId: string,
): Promise<Result<AcceptFightResult, FightError>> {
  const session = getSession(sessionId);
  if (!session) return ErrResult(new FightError("SESSION_NOT_FOUND", "Fight session not found"));

  if (new Date() > session.expiresAt) {
    deleteSession(sessionId);
    return ErrResult(new FightError("SESSION_EXPIRED", "Fight invitation has expired"));
  }

  if (session.p2Id !== accepterId) {
    return ErrResult(new FightError("NOT_YOUR_FIGHT", "This fight invitation is not for you"));
  }

  if (session.status !== "pending") {
    return ErrResult(new FightError("SESSION_NOT_ACTIVE", "Fight is not in pending state"));
  }

  session.status = "active";
  saveSession(session);

  // Mark both players as fighting
  await Promise.all([
    patchRpgProfile(ctx, session.p1Id, { isFighting: true, activeFightId: sessionId }),
    patchRpgProfile(ctx, session.p2Id, { isFighting: true, activeFightId: sessionId }),
  ]);

  return OkResult({ sessionId, p1Id: session.p1Id, p2Id: session.p2Id });
}

// ---------------------------------------------------------------------------
// submitMove
// ---------------------------------------------------------------------------

export async function submitMove(
  ctx: Ctx,
  sessionId: string,
  playerId: string,
  move: "attack" | "block",
): Promise<Result<SubmitMoveResult, FightError>> {
  const lockKey = `fight:round:${sessionId}`;
  if (!locks.tryAcquire(lockKey)) {
    return ErrResult(new FightError("FIGHT_LOCKED", "Round resolution is in progress"));
  }

  try {
    const session = getSession(sessionId);
    if (!session) return ErrResult(new FightError("SESSION_NOT_FOUND", "Fight session not found"));
    if (session.status !== "active") {
      return ErrResult(new FightError("SESSION_NOT_ACTIVE", "Fight is not active"));
    }
    if (session.p1Id !== playerId && session.p2Id !== playerId) {
      return ErrResult(new FightError("NOT_YOUR_FIGHT", "You are not in this fight"));
    }
    if (session.pendingMoves.has(playerId)) {
      return ErrResult(
        new FightError("ALREADY_MOVED", "You have already submitted a move this round"),
      );
    }

    session.pendingMoves.set(playerId, move);

    // Both players have moved — resolve round
    if (session.pendingMoves.size < 2) {
      saveSession(session);
      return OkResult({ roundResolved: false, combatEnded: false });
    }

    const p1Move = session.pendingMoves.get(session.p1Id) as CombatMove;
    const p2Move = session.pendingMoves.get(session.p2Id) as CombatMove;
    session.pendingMoves.clear();

    const round = CombatEngine.resolveRound(session, p1Move, p2Move);
    session.p1Hp = round.p1Hp;
    session.p2Hp = round.p2Hp;
    session.rounds.push(round);
    session.currentRound++;

    if (!CombatEngine.isCombatEnded(session)) {
      saveSession(session);
      return OkResult({ roundResolved: true, combatEnded: false, round });
    }

    // Combat ended
    const combatResult = CombatEngine.buildCombatResult(session);
    session.status = "completed";
    session.winnerId = combatResult.winnerId;
    saveSession(session);

    // Update profiles: clear fighting state
    await Promise.all([
      patchRpgProfile(ctx, combatResult.winnerId, { isFighting: false, activeFightId: null }),
      patchRpgProfile(ctx, combatResult.loserId, { isFighting: false, activeFightId: null }),
    ]);

    return OkResult({ roundResolved: true, combatEnded: true, round, combatResult });
  } finally {
    locks.release(lockKey);
  }
}

// ---------------------------------------------------------------------------
// forfeit
// ---------------------------------------------------------------------------

export async function forfeit(
  ctx: Ctx,
  sessionId: string,
  playerId: string,
): Promise<Result<CombatResult, FightError>> {
  const session = getSession(sessionId);
  if (!session) return ErrResult(new FightError("SESSION_NOT_FOUND", "Fight session not found"));
  if (session.p1Id !== playerId && session.p2Id !== playerId) {
    return ErrResult(new FightError("NOT_YOUR_FIGHT", "You are not in this fight"));
  }
  if (session.status !== "active" && session.status !== "pending") {
    return ErrResult(new FightError("SESSION_NOT_ACTIVE", "Fight is not active"));
  }

  const loserId = playerId;
  const winnerId = playerId === session.p1Id ? session.p2Id : session.p1Id;

  session.status = "completed";
  session.winnerId = winnerId;
  saveSession(session);

  const combatResult: CombatResult = {
    sessionId,
    winnerId,
    loserId,
    totalRounds: session.currentRound - 1,
    finalHp: {
      winner: winnerId === session.p1Id ? session.p1Hp : session.p2Hp,
      loser: 0,
    },
    rounds: session.rounds,
    endedAt: new Date(),
  };

  await Promise.all([
    patchRpgProfile(ctx, winnerId, { isFighting: false, activeFightId: null }),
    patchRpgProfile(ctx, loserId, { isFighting: false, activeFightId: null }),
  ]);

  return OkResult(combatResult);
}

// ---------------------------------------------------------------------------
// getSession (read-only view)
// ---------------------------------------------------------------------------

export function getFightSession(sessionId: string): ActiveCombatSession | null {
  return getSession(sessionId);
}
