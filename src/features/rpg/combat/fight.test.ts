/**
 * Tests for the fight orchestration service.
 * Mocks @/core/state and @/db/repositories/rpg.
 */

import { describe, expect, test, mock, beforeEach } from "bun:test";
import { OkResult } from "@/core/result";
import type { RpgProfileData } from "@/db/schemas/rpg-profile";

// ---------------------------------------------------------------------------
// Mock @/core/state BEFORE importing fight
// ---------------------------------------------------------------------------

const sessionMap = new Map<string, unknown>();
const lockState = new Set<string>();

mock.module("@/core/state", () => ({
  sessions: {
    get: mock((key: string) => sessionMap.get(key)),
    set: mock((key: string, val: unknown) => { sessionMap.set(key, val); }),
    delete: mock((key: string) => { sessionMap.delete(key); }),
    has: mock((key: string) => sessionMap.has(key)),
  },
  locks: {
    tryAcquire: mock((key: string) => {
      if (lockState.has(key)) return false;
      lockState.add(key);
      return true;
    }),
    release: mock((key: string) => { lockState.delete(key); }),
    isHeld: mock((key: string) => lockState.has(key)),
  },
  cooldowns: {
    isOnCooldown: mock(() => false),
    getRemainingMs: mock(() => 0),
    set: mock(() => {}),
  },
}));

// ---------------------------------------------------------------------------
// Mock @/db/repositories/rpg BEFORE importing fight
// ---------------------------------------------------------------------------

const profileStore = new Map<string, RpgProfileData>();

function makeProfile(overrides: Partial<RpgProfileData> = {}): RpgProfileData {
  return {
    loadout: { weapon: null, shield: null, helmet: null, chest: null, pants: null, boots: null, ring: null, necklace: null },
    hpCurrent: 100,
    wins: 0,
    losses: 0,
    isFighting: false,
    activeFightId: null,
    starterKitType: null,
    starterKitClaimedAt: null,
    stashSize: 20,
    activeExpeditionId: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    version: 0,
    ...overrides,
  };
}

const mockEnsureRpgProfile = mock(async (userId: string) => {
  if (!profileStore.has(userId)) profileStore.set(userId, makeProfile());
  return OkResult(profileStore.get(userId)!);
});
const mockPatchRpgProfile = mock(async (userId: string, patch: Partial<RpgProfileData>) => {
  const existing = profileStore.get(userId) ?? makeProfile();
  const updated = { ...existing, ...patch };
  profileStore.set(userId, updated);
  return OkResult(updated);
});

mock.module("@/db/repositories/rpg", () => ({
  ensureRpgProfile: mockEnsureRpgProfile,
  patchRpgProfile: mockPatchRpgProfile,
  getRpgProfile: mock(async (userId: string) => OkResult(profileStore.get(userId) ?? null)),
  rpgStore: {},
}));

// ---------------------------------------------------------------------------
// Import AFTER mocking
// ---------------------------------------------------------------------------

const { initiateFight, acceptFight, submitMove, forfeit, getFightSession, FightError } =
  await import("./fight");

// ---------------------------------------------------------------------------
// Reset helpers
// ---------------------------------------------------------------------------

function resetAll() {
  sessionMap.clear();
  lockState.clear();
  profileStore.clear();
  mockEnsureRpgProfile.mockReset();
  mockPatchRpgProfile.mockReset();

  mockEnsureRpgProfile.mockImplementation(async (userId: string) => {
    if (!profileStore.has(userId)) profileStore.set(userId, makeProfile());
    return OkResult(profileStore.get(userId)!);
  });
  mockPatchRpgProfile.mockImplementation(async (userId: string, patch: Partial<RpgProfileData>) => {
    const existing = profileStore.get(userId) ?? makeProfile();
    const updated = { ...existing, ...patch };
    profileStore.set(userId, updated);
    return OkResult(updated);
  });
}

// ---------------------------------------------------------------------------
// initiateFight tests
// ---------------------------------------------------------------------------

describe("initiateFight", () => {
  beforeEach(resetAll);

  test("creates a pending session", async () => {
    const result = await initiateFight("p1", "p2");

    expect(result.isOk()).toBe(true);
    const data = result.unwrap();
    expect(data.inviterId).toBe("p1");
    expect(data.targetId).toBe("p2");
    expect(data.sessionId).toMatch(/^combat_/);
    expect(data.expiresAt).toBeInstanceOf(Date);

    const session = getFightSession(data.sessionId);
    expect(session?.status).toBe("pending");
    expect(session?.p1Id).toBe("p1");
    expect(session?.p2Id).toBe("p2");
  });

  test("rejects self-combat", async () => {
    const result = await initiateFight("p1", "p1");
    if (result.isOk()) throw new Error("Expected error but got Ok");
    const err = result.error as InstanceType<typeof FightError>;
    expect(err.code).toBe("SELF_COMBAT");
  });

  test("rejects when inviter already fighting", async () => {
    profileStore.set("p1", makeProfile({ isFighting: true }));

    const result = await initiateFight("p1", "p2");
    if (result.isOk()) throw new Error("Expected error but got Ok");
    const err = result.error as InstanceType<typeof FightError>;
    expect(err.code).toBe("IN_COMBAT");
  });

  test("rejects when target already fighting", async () => {
    profileStore.set("p2", makeProfile({ isFighting: true }));

    const result = await initiateFight("p1", "p2");
    if (result.isOk()) throw new Error("Expected error but got Ok");
    const err = result.error as InstanceType<typeof FightError>;
    expect(err.code).toBe("IN_COMBAT");
  });

  test("uses provided stats", async () => {
    const result = await initiateFight("p1", "p2", {
      p1Stats: { atk: 30, def: 10, maxHp: 120 },
      p2Stats: { atk: 25, def: 8, maxHp: 90 },
    });

    expect(result.isOk()).toBe(true);
    const session = getFightSession(result.unwrap().sessionId)!;
    expect(session.p1Atk).toBe(30);
    expect(session.p1MaxHp).toBe(120);
    expect(session.p2Atk).toBe(25);
    expect(session.p2MaxHp).toBe(90);
  });
});

// ---------------------------------------------------------------------------
// acceptFight tests
// ---------------------------------------------------------------------------

describe("acceptFight", () => {
  beforeEach(resetAll);

  test("transitions session to active and marks players fighting", async () => {
    const { sessionId } = (await initiateFight("p1", "p2")).unwrap();

    const result = await acceptFight(sessionId, "p2");

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().p1Id).toBe("p1");

    const session = getFightSession(sessionId);
    expect(session?.status).toBe("active");

    expect(profileStore.get("p1")?.isFighting).toBe(true);
    expect(profileStore.get("p2")?.isFighting).toBe(true);
  });

  test("rejects when session not found", async () => {
    const result = await acceptFight("nonexistent", "p2");
    if (result.isOk()) throw new Error("Expected error but got Ok");
    const err = result.error as InstanceType<typeof FightError>;
    expect(err.code).toBe("SESSION_NOT_FOUND");
  });

  test("rejects when wrong player accepts", async () => {
    const { sessionId } = (await initiateFight("p1", "p2")).unwrap();
    const result = await acceptFight(sessionId, "p1"); // p1 shouldn't accept their own invite
    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof FightError>;
    expect(err.code).toBe("NOT_YOUR_FIGHT");
  });
});

// ---------------------------------------------------------------------------
// submitMove tests
// ---------------------------------------------------------------------------

describe("submitMove", () => {
  beforeEach(resetAll);

  async function startActiveFight(): Promise<string> {
    const { sessionId } = (await initiateFight("p1", "p2")).unwrap();
    await acceptFight(sessionId, "p2");
    return sessionId;
  }

  test("waits for both moves before resolving round", async () => {
    const sessionId = await startActiveFight();

    const r1 = await submitMove(sessionId, "p1", "attack");
    expect(r1.isOk()).toBe(true);
    expect(r1.unwrap().roundResolved).toBe(false);
  });

  test("resolves round when both players submit moves", async () => {
    const sessionId = await startActiveFight();

    await submitMove(sessionId, "p1", "attack");
    const r2 = await submitMove(sessionId, "p2", "attack");

    expect(r2.isOk()).toBe(true);
    const data = r2.unwrap();
    expect(data.roundResolved).toBe(true);
    expect(data.round).toBeDefined();
    expect(data.round!.roundNumber).toBe(1);

    const session = getFightSession(sessionId);
    if (!data.combatEnded) {
      // HP should have changed
      expect(session?.p1Hp).toBeLessThanOrEqual(100);
      expect(session?.p2Hp).toBeLessThanOrEqual(100);
      // Round counter advanced
      expect(session?.currentRound).toBe(2);
    }
  });

  test("rejects when player submits move twice in same round", async () => {
    const sessionId = await startActiveFight();
    await submitMove(sessionId, "p1", "attack");

    const result = await submitMove(sessionId, "p1", "block");
    if (result.isOk()) throw new Error("Expected error but got Ok");
    const err = result.error as InstanceType<typeof FightError>;
    expect(err.code).toBe("ALREADY_MOVED");
  });

  test("rejects when outsider submits move", async () => {
    const sessionId = await startActiveFight();
    const result = await submitMove(sessionId, "outsider", "attack");
    if (result.isOk()) throw new Error("Expected error but got Ok");
    const err = result.error as InstanceType<typeof FightError>;
    expect(err.code).toBe("NOT_YOUR_FIGHT");
  });

  test("ends combat when a player reaches 0 HP", async () => {
    // Use extreme stats to guarantee combat ends in one round
    const { sessionId } = (await initiateFight("p1", "p2", {
      p1Stats: { atk: 1000, def: 0, maxHp: 10 },
      p2Stats: { atk: 1000, def: 0, maxHp: 10 },
    })).unwrap();
    await acceptFight(sessionId, "p2");

    await submitMove(sessionId, "p1", "attack");
    const result = await submitMove(sessionId, "p2", "attack");

    expect(result.isOk()).toBe(true);
    const data = result.unwrap();
    expect(data.combatEnded).toBe(true);
    expect(data.combatResult).toBeDefined();
    expect(data.combatResult!.winnerId).toBeDefined();
    expect(data.combatResult!.loserId).toBeDefined();

    // Profiles should be updated
    expect(profileStore.get("p1")?.isFighting).toBe(false);
    expect(profileStore.get("p2")?.isFighting).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// forfeit tests
// ---------------------------------------------------------------------------

describe("forfeit", () => {
  beforeEach(resetAll);

  test("p1 forfeiting makes p2 the winner", async () => {
    const { sessionId } = (await initiateFight("p1", "p2")).unwrap();
    await acceptFight(sessionId, "p2");

    const result = await forfeit(sessionId, "p1");

    expect(result.isOk()).toBe(true);
    const combatResult = result.unwrap();
    expect(combatResult.winnerId).toBe("p2");
    expect(combatResult.loserId).toBe("p1");

    expect(profileStore.get("p1")?.isFighting).toBe(false);
    expect(profileStore.get("p2")?.isFighting).toBe(false);
  });

  test("returns SESSION_NOT_FOUND for unknown session", async () => {
    const result = await forfeit("nonexistent", "p1");
    if (result.isOk()) throw new Error("Expected error but got Ok");
    const err = result.error as InstanceType<typeof FightError>;
    expect(err.code).toBe("SESSION_NOT_FOUND");
  });

  test("returns NOT_YOUR_FIGHT for non-participant", async () => {
    const { sessionId } = (await initiateFight("p1", "p2")).unwrap();
    const result = await forfeit(sessionId, "outsider");
    if (result.isOk()) throw new Error("Expected error but got Ok");
    const err = result.error as InstanceType<typeof FightError>;
    expect(err.code).toBe("NOT_YOUR_FIGHT");
  });
});
