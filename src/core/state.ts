// ─── CooldownManager ─────────────────────────────────────────────────────────
export class CooldownManager {
  private readonly map = new Map<string, number>();

  private key(userId: string, command: string): string {
    return `${userId}:${command}`;
  }

  set(userId: string, command: string, durationMs: number): void {
    this.map.set(this.key(userId, command), Date.now() + durationMs);
  }

  isOnCooldown(userId: string, command: string): boolean {
    const k = this.key(userId, command);
    const expiresAt = this.map.get(k);
    if (expiresAt === undefined) return false;
    if (Date.now() >= expiresAt) {
      this.map.delete(k);
      return false;
    }
    return true;
  }

  getRemainingMs(userId: string, command: string): number {
    const expiresAt = this.map.get(this.key(userId, command));
    if (expiresAt === undefined) return 0;
    return Math.max(0, expiresAt - Date.now());
  }

  clear(userId: string, command: string): void {
    this.map.delete(this.key(userId, command));
  }
}

// ─── SessionManager ───────────────────────────────────────────────────────────
/**
 * Generic typed session store. Features create their own instances: `new SessionManager<MyType>()`.
 * NOTE: No TTL or size limit. Callers are responsible for deleting entries to avoid unbounded growth.
 */
export class SessionManager<T> {
  private readonly map = new Map<string, T>();

  get(key: string): T | undefined {
    return this.map.get(key);
  }

  set(key: string, value: T): void {
    this.map.set(key, value);
  }

  delete(key: string): void {
    this.map.delete(key);
  }

  has(key: string): boolean {
    return this.map.has(key);
  }
}

// ─── LockSet ─────────────────────────────────────────────────────────────────
/** Exclusive operation locks with stale-timeout auto-release. */
export class LockSet {
  private readonly locks = new Map<string, number>();
  private readonly staleMs: number;

  constructor(staleMs = 5 * 60 * 1000) {
    this.staleMs = staleMs;
  }

  tryAcquire(key: string): boolean {
    const acquiredAt = this.locks.get(key);
    // Stale lock: treat as if it was never acquired and overwrite it.
    if (acquiredAt !== undefined && Date.now() - acquiredAt < this.staleMs) {
      return false;
    }
    this.locks.set(key, Date.now());
    return true;
  }

  release(key: string): void {
    this.locks.delete(key);
  }

  isHeld(key: string): boolean {
    const acquiredAt = this.locks.get(key);
    if (acquiredAt === undefined) return false;
    if (Date.now() - acquiredAt >= this.staleMs) {
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
