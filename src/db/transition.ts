/**
 * Optimistic compare-and-swap (CAS) helper for concurrent document mutations.
 *
 * The caller supplies the storage details: read the current document, extract a
 * stable snapshot, compute the next state, and commit only if that snapshot is
 * still current. A `null` commit means normal contention, not failure, so this
 * helper retries with fresh data.
 *
 * Why this shape exists: some feature mutations touch nested user/economy state
 * where Mongo transactions are overkill, but blind read-modify-write would lose
 * concurrent updates. This isolates the retry loop while keeping domain rules
 * in the caller-provided `computeNext`.
 *
 * Replaces the old codebase's `runUserTransition` pattern.
 */

import { ErrResult, OkResult, type Result } from "@/core/result";

export type AtomicTransitionParams<TUser, TSnapshot, TNext, TOut> = {
  attempts: number;
  getInitial: () => Promise<Result<TUser, Error>>;
  getFresh: (previousUser: TUser, previousSnapshot: TSnapshot) => Promise<Result<TUser, Error>>;
  getSnapshot: (user: TUser) => TSnapshot;
  computeNext: (snapshot: TSnapshot) => Promise<Result<TNext, Error>> | Result<TNext, Error>;
  commit: (expected: TSnapshot, next: TNext) => Promise<Result<TUser | null, Error>>;
  project: (updatedUser: TUser, next: TNext, expected: TSnapshot) => TOut;
  onExhausted: (lastUser: TUser, lastSnapshot: TSnapshot) => Result<TOut, Error>;
};

/**
 * Run a bounded CAS retry loop.
 *
 * Returns `Err` immediately for validation/infrastructure failures. Calls
 * `onExhausted` after the configured attempts if every commit loses a race.
 */
export async function atomicTransition<TUser, TSnapshot, TNext, TOut>(
  params: AtomicTransitionParams<TUser, TSnapshot, TNext, TOut>,
): Promise<Result<TOut, Error>> {
  const initial = await params.getInitial();
  if (initial.isErr()) return ErrResult(initial.error);

  let user = initial.unwrap();
  let snapshot = params.getSnapshot(user);

  for (let attempt = 0; attempt < params.attempts; attempt += 1) {
    const nextRes = await params.computeNext(snapshot);
    if (nextRes.isErr()) return ErrResult(nextRes.error);
    const next = nextRes.unwrap();

    const committed = await params.commit(snapshot, next);
    if (committed.isErr()) return ErrResult(committed.error);

    const updatedUser = committed.unwrap();
    if (updatedUser) {
      return OkResult(params.project(updatedUser, next, snapshot));
    }

    // WHY: a null commit means the expected snapshot no longer matched. Refresh
    // using caller-owned logic so the caller can preserve projection-specific
    // fields or reload from the authoritative repository.
    const fresh = await params.getFresh(user, snapshot);
    if (fresh.isErr()) return ErrResult(fresh.error);

    user = fresh.unwrap();
    snapshot = params.getSnapshot(user);
  }

  return params.onExhausted(user, snapshot);
}
