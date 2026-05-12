/**
 * In-memory expedition session store.
 *
 * An expedition is conversational and short-lived — persisting it to the DB
 * would add writes on every button click for state (biome, depth, visible nodes)
 * that is meaningless after the session ends. Tool durability and inventory
 * changes ARE persisted by the gathering domain on every gather action.
 *
 * Accepted limitation: sessions are lost on bot restart. Players re-run
 * /expedition to start a new one.
 *
 * A second /expedition invocation from the same user overwrites their active
 * session. This is intentional — the old message's buttons become stale
 * and we honour the newest intent.
 */

import { generateNodes, MAX_DEPTH, type Biome, type Depth, type ExpeditionNode } from "./world";

export interface ExpeditionState {
  readonly userId: string;
  readonly biome: Biome;
  readonly depth: Depth;
  readonly nodes: readonly ExpeditionNode[];
  readonly startedAt: number;
}

const TTL_MS = 10 * 60 * 1000; // 10 minutes

const SESSIONS = new Map<string, ExpeditionState>();

function isExpired(state: ExpeditionState): boolean {
  return Date.now() - state.startedAt > TTL_MS;
}

/** Create or replace a session for the user, starting at depth 1. */
export function startSession(userId: string, biome: Biome): ExpeditionState {
  const state: ExpeditionState = {
    userId,
    biome,
    depth: 1,
    nodes: generateNodes(biome, 1),
    startedAt: Date.now(),
  };
  SESSIONS.set(userId, state);
  return state;
}

/**
 * Returns the active session if it exists and has not expired.
 * Cleans up expired sessions on access.
 */
export function getSession(userId: string): ExpeditionState | null {
  const state = SESSIONS.get(userId);
  if (!state) return null;
  if (isExpired(state)) {
    SESSIONS.delete(userId);
    return null;
  }
  return state;
}

/**
 * Advance depth by 1 and regenerate visible nodes.
 * Returns null if already at MAX_DEPTH or the session is expired/missing.
 */
export function advance(userId: string): ExpeditionState | null {
  const state = getSession(userId);
  if (!state) return null;
  if (state.depth >= MAX_DEPTH) return null;
  const newDepth = (state.depth + 1) as Depth;
  const next: ExpeditionState = {
    ...state,
    depth: newDepth,
    nodes: generateNodes(state.biome, newDepth),
    startedAt: Date.now(),
  };
  SESSIONS.set(userId, next);
  return next;
}

/** Regenerate visible nodes at the current depth (called after each successful gather). */
export function regenNodes(userId: string): ExpeditionState | null {
  const state = getSession(userId);
  if (!state) return null;
  const next: ExpeditionState = {
    ...state,
    nodes: generateNodes(state.biome, state.depth),
    startedAt: Date.now(),
  };
  SESSIONS.set(userId, next);
  return next;
}

export function endSession(userId: string): void {
  SESSIONS.delete(userId);
}
