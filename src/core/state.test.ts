import { beforeEach, describe, expect, test } from "bun:test";
import { CooldownManager, LockSet, SessionManager } from "./state";

// Drive time from injected clocks so expiry tests do not touch global Date.now.
let now = 0;

beforeEach(() => {
  now = 1_700_000_000_000;
});

function advance(ms: number): void {
  now += ms;
}

function nowFn(): number {
  return now;
}

describe("CooldownManager", () => {
  test("isOnCooldown returns false for unknown user+command", () => {
    const mgr = new CooldownManager(nowFn);
    expect(mgr.isOnCooldown("user1", "work")).toBe(false);
  });

  test("isOnCooldown returns true immediately after set", () => {
    const mgr = new CooldownManager(nowFn);
    mgr.set("user1", "work", 60_000);
    expect(mgr.isOnCooldown("user1", "work")).toBe(true);
  });

  test("isOnCooldown returns false after expiry", () => {
    const mgr = new CooldownManager(nowFn);
    mgr.set("user1", "work", 10);
    advance(20);
    expect(mgr.isOnCooldown("user1", "work")).toBe(false);
  });

  test("getRemainingMs returns positive value before expiry", () => {
    const mgr = new CooldownManager(nowFn);
    mgr.set("user1", "work", 60_000);
    expect(mgr.getRemainingMs("user1", "work")).toBeGreaterThan(0);
  });

  test("getRemainingMs returns 0 after expiry", () => {
    const mgr = new CooldownManager(nowFn);
    mgr.set("user1", "work", 10);
    advance(20);
    expect(mgr.getRemainingMs("user1", "work")).toBe(0);
  });

  test("clear removes the cooldown", () => {
    const mgr = new CooldownManager(nowFn);
    mgr.set("user1", "work", 60_000);
    mgr.clear("user1", "work");
    expect(mgr.isOnCooldown("user1", "work")).toBe(false);
  });

  test("different commands are independent", () => {
    const mgr = new CooldownManager(nowFn);
    mgr.set("user1", "work", 60_000);
    expect(mgr.isOnCooldown("user1", "daily")).toBe(false);
  });

  test("different users are independent", () => {
    const mgr = new CooldownManager(nowFn);
    mgr.set("user1", "work", 60_000);
    expect(mgr.isOnCooldown("user2", "work")).toBe(false);
  });
});

describe("SessionManager", () => {
  test("get returns undefined when empty", () => {
    const mgr = new SessionManager<string>({ now: nowFn });
    expect(mgr.get("key1")).toBeUndefined();
  });

  test("set and get round-trip", () => {
    const mgr = new SessionManager<number>({ now: nowFn });
    mgr.set("key1", 42);
    expect(mgr.get("key1")).toBe(42);
  });

  test("has returns false when not set", () => {
    const mgr = new SessionManager<string>({ now: nowFn });
    expect(mgr.has("key1")).toBe(false);
  });

  test("has returns true after set", () => {
    const mgr = new SessionManager<string>({ now: nowFn });
    mgr.set("key1", "data");
    expect(mgr.has("key1")).toBe(true);
  });

  test("delete removes the entry", () => {
    const mgr = new SessionManager<string>({ now: nowFn });
    mgr.set("key1", "data");
    mgr.delete("key1");
    expect(mgr.has("key1")).toBe(false);
  });

  test("entries expire after the configured ttl", () => {
    const mgr = new SessionManager<string>({ ttlMs: 10, maxEntries: null, now: nowFn });
    mgr.set("key1", "data");

    advance(11);

    expect(mgr.get("key1")).toBeUndefined();
    expect(mgr.has("key1")).toBe(false);
  });

  test("ttl can be disabled", () => {
    const mgr = new SessionManager<string>({ ttlMs: null, maxEntries: null, now: nowFn });
    mgr.set("key1", "data");

    advance(365 * 24 * 60 * 60 * 1000);

    expect(mgr.get("key1")).toBe("data");
    expect(mgr.has("key1")).toBe(true);
  });

  test("maxEntries evicts least recently used entries", () => {
    const mgr = new SessionManager<string>({ ttlMs: null, maxEntries: 2, now: nowFn });
    mgr.set("first", "a");
    mgr.set("second", "b");
    expect(mgr.get("first")).toBe("a");

    mgr.set("third", "c");

    expect(mgr.get("first")).toBe("a");
    expect(mgr.get("second")).toBeUndefined();
    expect(mgr.get("third")).toBe("c");
  });

  test("set prunes expired entries before enforcing maxEntries", () => {
    const mgr = new SessionManager<string>({ ttlMs: 10, maxEntries: 2, now: nowFn });
    mgr.set("expired", "a");
    advance(11);

    mgr.set("fresh1", "b");
    mgr.set("fresh2", "c");

    expect(mgr.get("expired")).toBeUndefined();
    expect(mgr.get("fresh1")).toBe("b");
    expect(mgr.get("fresh2")).toBe("c");
  });
});

describe("LockSet", () => {
  test("isHeld returns false when lock not acquired", () => {
    const locks = new LockSet(5 * 60 * 1000, nowFn);
    expect(locks.isHeld("op1")).toBe(false);
  });

  test("tryAcquire returns true first time", () => {
    const locks = new LockSet(5 * 60 * 1000, nowFn);
    expect(locks.tryAcquire("op1")).toBe(true);
  });

  test("tryAcquire returns false if already held", () => {
    const locks = new LockSet(5 * 60 * 1000, nowFn);
    locks.tryAcquire("op1");
    expect(locks.tryAcquire("op1")).toBe(false);
  });

  test("release allows re-acquire", () => {
    const locks = new LockSet(5 * 60 * 1000, nowFn);
    locks.tryAcquire("op1");
    locks.release("op1");
    expect(locks.tryAcquire("op1")).toBe(true);
  });

  test("stale lock can be re-acquired after timeout", () => {
    const locks = new LockSet(10, nowFn);
    locks.tryAcquire("op1");
    advance(20);
    expect(locks.tryAcquire("op1")).toBe(true);
  });
});
