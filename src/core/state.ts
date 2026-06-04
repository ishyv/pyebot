// ─── CooldownManager ─────────────────────────────────────────────────────────
type Clock = () => number;

const systemNow: Clock = () => Date.now();

export class CooldownManager {
  private readonly map = new Map<string, number>();
  private readonly now: Clock;

  constructor(now: Clock = systemNow) {
    this.now = now;
  }

  private key(userId: string, command: string): string {
    return `${userId}:${command}`;
  }

  set(userId: string, command: string, durationMs: number): void {
    this.map.set(this.key(userId, command), this.now() + durationMs);
  }

  isOnCooldown(userId: string, command: string): boolean {
    const k = this.key(userId, command);
    const expiresAt = this.map.get(k);
    if (expiresAt === undefined) return false;
    if (this.now() >= expiresAt) {
      this.map.delete(k);
      return false;
    }
    return true;
  }

  getRemainingMs(userId: string, command: string): number {
    const expiresAt = this.map.get(this.key(userId, command));
    if (expiresAt === undefined) return 0;
    return Math.max(0, expiresAt - this.now());
  }

  clear(userId: string, command: string): void {
    this.map.delete(this.key(userId, command));
  }
}

// ─── SessionManager ───────────────────────────────────────────────────────────
/**
 * Generic typed session store. Features create their own instances: `new SessionManager<MyType>()`.
 * Entries are bounded by a generous TTL and max size by default so missed
 * feature cleanup cannot leak memory for the whole process lifetime.
 */
export interface SessionManagerOptions {
  /** Milliseconds before an entry expires. `null` disables time-based expiry. */
  readonly ttlMs?: number | null;
  /** Maximum retained entries. `null` disables size-based eviction. */
  readonly maxEntries?: number | null;
  /** Clock used for expiry checks. Defaults to wall time. */
  readonly now?: Clock;
}

interface SessionEntry<T> {
  readonly value: T;
  readonly createdAt: number;
}

export class SessionManager<T> {
  private readonly map = new Map<string, SessionEntry<T>>();
  private readonly ttlMs: number | null;
  private readonly maxEntries: number | null;
  private readonly now: Clock;

  constructor(options: SessionManagerOptions = {}) {
    this.ttlMs = options.ttlMs === undefined ? 24 * 60 * 60 * 1000 : options.ttlMs;
    this.maxEntries = options.maxEntries === undefined ? 10_000 : options.maxEntries;
    this.now = options.now ?? systemNow;
  }

  get(key: string): T | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (this.isExpired(entry)) {
      this.map.delete(key);
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    this.pruneExpired();
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, createdAt: this.now() });
    this.enforceMaxEntries();
  }

  delete(key: string): void {
    this.map.delete(key);
  }

  has(key: string): boolean {
    const entry = this.map.get(key);
    if (!entry) return false;
    if (this.isExpired(entry)) {
      this.map.delete(key);
      return false;
    }
    return true;
  }

  private isExpired(entry: SessionEntry<T>): boolean {
    return this.ttlMs !== null && this.now() - entry.createdAt >= this.ttlMs;
  }

  private pruneExpired(): void {
    if (this.ttlMs === null) return;
    for (const [key, entry] of this.map) {
      if (this.isExpired(entry)) this.map.delete(key);
    }
  }

  private enforceMaxEntries(): void {
    if (this.maxEntries === null) return;
    while (this.map.size > this.maxEntries) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey === undefined) return;
      this.map.delete(oldestKey);
    }
  }
}

// ─── LockSet ─────────────────────────────────────────────────────────────────
/** Exclusive operation locks with stale-timeout auto-release. */
export class LockSet {
  private readonly locks = new Map<string, number>();
  private readonly staleMs: number;
  private readonly now: Clock;

  constructor(staleMs = 5 * 60 * 1000, now: Clock = systemNow) {
    this.staleMs = staleMs;
    this.now = now;
  }

  tryAcquire(key: string): boolean {
    const acquiredAt = this.locks.get(key);
    // Stale lock: treat as if it was never acquired and overwrite it.
    if (acquiredAt !== undefined && this.now() - acquiredAt < this.staleMs) {
      return false;
    }
    this.locks.set(key, this.now());
    return true;
  }

  release(key: string): void {
    this.locks.delete(key);
  }

  isHeld(key: string): boolean {
    const acquiredAt = this.locks.get(key);
    if (acquiredAt === undefined) return false;
    if (this.now() - acquiredAt >= this.staleMs) {
      this.locks.delete(key);
      return false;
    }
    return true;
  }
}

// ─── Singletons ──────────────────────────────────────────────────────────────
/** Global cooldown manager. All features import from here instead of creating their own Maps. */
export const cooldowns = new CooldownManager();

/** Global lock set for exclusive operations (quest claims, fight state, etc). */
export const locks = new LockSet();

/** Global session store for transient interaction state (trivia, confirmations, etc). */
export const sessions = new SessionManager<unknown>();
