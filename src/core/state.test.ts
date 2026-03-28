import { describe, expect, test } from "bun:test";
import { CooldownManager, SessionManager, LockSet } from "./state";

describe("CooldownManager", () => {
  test("isOnCooldown returns false for unknown user+command", () => {
    const mgr = new CooldownManager();
    expect(mgr.isOnCooldown("user1", "work")).toBe(false);
  });

  test("isOnCooldown returns true immediately after set", () => {
    const mgr = new CooldownManager();
    mgr.set("user1", "work", 60_000);
    expect(mgr.isOnCooldown("user1", "work")).toBe(true);
  });

  test("isOnCooldown returns false after expiry", async () => {
    const mgr = new CooldownManager();
    mgr.set("user1", "work", 10);
    await new Promise((r) => setTimeout(r, 20));
    expect(mgr.isOnCooldown("user1", "work")).toBe(false);
  });

  test("getRemainingMs returns positive value before expiry", () => {
    const mgr = new CooldownManager();
    mgr.set("user1", "work", 60_000);
    expect(mgr.getRemainingMs("user1", "work")).toBeGreaterThan(0);
  });

  test("getRemainingMs returns 0 after expiry", async () => {
    const mgr = new CooldownManager();
    mgr.set("user1", "work", 10);
    await new Promise((r) => setTimeout(r, 20));
    expect(mgr.getRemainingMs("user1", "work")).toBe(0);
  });

  test("clear removes the cooldown", () => {
    const mgr = new CooldownManager();
    mgr.set("user1", "work", 60_000);
    mgr.clear("user1", "work");
    expect(mgr.isOnCooldown("user1", "work")).toBe(false);
  });

  test("different commands are independent", () => {
    const mgr = new CooldownManager();
    mgr.set("user1", "work", 60_000);
    expect(mgr.isOnCooldown("user1", "daily")).toBe(false);
  });

  test("different users are independent", () => {
    const mgr = new CooldownManager();
    mgr.set("user1", "work", 60_000);
    expect(mgr.isOnCooldown("user2", "work")).toBe(false);
  });
});

describe("SessionManager", () => {
  test("get returns undefined when empty", () => {
    const mgr = new SessionManager<string>();
    expect(mgr.get("key1")).toBeUndefined();
  });

  test("set and get round-trip", () => {
    const mgr = new SessionManager<number>();
    mgr.set("key1", 42);
    expect(mgr.get("key1")).toBe(42);
  });

  test("has returns false when not set", () => {
    const mgr = new SessionManager<string>();
    expect(mgr.has("key1")).toBe(false);
  });

  test("has returns true after set", () => {
    const mgr = new SessionManager<string>();
    mgr.set("key1", "data");
    expect(mgr.has("key1")).toBe(true);
  });

  test("delete removes the entry", () => {
    const mgr = new SessionManager<string>();
    mgr.set("key1", "data");
    mgr.delete("key1");
    expect(mgr.has("key1")).toBe(false);
  });
});

describe("LockSet", () => {
  test("isHeld returns false when lock not acquired", () => {
    const locks = new LockSet();
    expect(locks.isHeld("op1")).toBe(false);
  });

  test("tryAcquire returns true first time", () => {
    const locks = new LockSet();
    expect(locks.tryAcquire("op1")).toBe(true);
  });

  test("tryAcquire returns false if already held", () => {
    const locks = new LockSet();
    locks.tryAcquire("op1");
    expect(locks.tryAcquire("op1")).toBe(false);
  });

  test("release allows re-acquire", () => {
    const locks = new LockSet();
    locks.tryAcquire("op1");
    locks.release("op1");
    expect(locks.tryAcquire("op1")).toBe(true);
  });

  test("stale lock can be re-acquired after timeout", async () => {
    const locks = new LockSet(10); // 10ms stale timeout
    locks.tryAcquire("op1");
    await new Promise((r) => setTimeout(r, 20));
    expect(locks.tryAcquire("op1")).toBe(true);
  });
});
