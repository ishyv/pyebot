/**
 * Tests for the fight orchestration service.
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { RpgProfileValue } from "@/components/rpg-profile";
import type { Ctx } from "@/framework/types";

const sessionMap = new Map<string, unknown>();
const lockState = new Set<string>();

mock.module("@/core/state", () => ({
  sessions: {
    get: mock((key: string) => sessionMap.get(key)),
    set: mock((key: string, val: unknown) => {
      sessionMap.set(key, val);
    }),
    delete: mock((key: string) => {
      sessionMap.delete(key);
    }),
    has: mock((key: string) => sessionMap.has(key)),
  },
  locks: {
    tryAcquire: mock((key: string) => {
      if (lockState.has(key)) return false;
      lockState.add(key);
      return true;
    }),
    release: mock((key: string) => {
      lockState.delete(key);
    }),
    isHeld: mock((key: string) => lockState.has(key)),
  },
  cooldowns: {
    isOnCooldown: mock(() => false),
    getRemainingMs: mock(() => 0),
    set: mock(() => {}),
  },
}));

const profileStore = new Map<string, RpgProfileValue>();

function makeProfile(overrides: Partial<RpgProfileValue> = {}): RpgProfileValue {
  return {
    loadout: {
      weapon: null,
      shield: null,
      helmet: null,
      chest: null,
      pants: null,
      boots: null,
      ring: null,
      necklace: null,
    },
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

function makeCtx(): Ctx {
  return {
    async get(id: string) {
      return profileStore.get(id) ?? null;
    },
    async ensure(id: string) {
      let profile = profileStore.get(id);
      if (!profile) {
        profile = makeProfile();
        profileStore.set(id, profile);
      }
      return profile;
    },
    async patch(id: string, _component: unknown, patch: Partial<RpgProfileValue>) {
      const existing = profileStore.get(id) ?? makeProfile();
      profileStore.set(id, { ...existing, ...patch });
    },
    async set() {},
    async delete() {},
    async query() {
      return [];
    },
    async emit() {},
    client: {},
    logger: { info() {}, warn() {}, error() {}, debug() {} },
    cooldowns: {},
    locks: {},
    sessions: {},
    interaction: null,
  } as unknown as Ctx;
}

const { initiateFight, acceptFight, submitMove, forfeit, getFightSession, FightError } =
  await import("./fight");

let ctx: Ctx;

function resetAll() {
  sessionMap.clear();
  lockState.clear();
  profileStore.clear();
  ctx = makeCtx();
}

describe("initiateFight", () => {
  beforeEach(resetAll);

  test("creates a pending session", async () => {
    const result = await initiateFight(ctx, "p1", "p2");

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
    const result = await initiateFight(ctx, "p1", "p1");
    if (result.isOk()) throw new Error("Expected error but got Ok");
    const err = result.error as InstanceType<typeof FightError>;
    expect(err.code).toBe("SELF_COMBAT");
  });

  test("rejects when inviter already fighting", async () => {
    profileStore.set("p1", makeProfile({ isFighting: true }));

    const result = await initiateFight(ctx, "p1", "p2");
    if (result.isOk()) throw new Error("Expected error but got Ok");
    const err = result.error as InstanceType<typeof FightError>;
    expect(err.code).toBe("IN_COMBAT");
  });

  test("rejects when target already fighting", async () => {
    profileStore.set("p2", makeProfile({ isFighting: true }));

    const result = await initiateFight(ctx, "p1", "p2");
    if (result.isOk()) throw new Error("Expected error but got Ok");
    const err = result.error as InstanceType<typeof FightError>;
    expect(err.code).toBe("IN_COMBAT");
  });

  test("uses provided stats", async () => {
    const result = await initiateFight(ctx, "p1", "p2", {
      p1Stats: { atk: 30, def: 10, maxHp: 120 },
      p2Stats: { atk: 25, def: 8, maxHp: 90 },
    });

    expect(result.isOk()).toBe(true);
    const session = getFightSession(result.unwrap().sessionId);
    if (!session) throw new Error("Expected fight session to be stored");
    expect(session.p1Atk).toBe(30);
    expect(session.p1MaxHp).toBe(120);
    expect(session.p2Atk).toBe(25);
    expect(session.p2MaxHp).toBe(90);
  });
});

describe("acceptFight", () => {
  beforeEach(resetAll);

  test("transitions session to active and marks players fighting", async () => {
    const { sessionId } = (await initiateFight(ctx, "p1", "p2")).unwrap();

    const result = await acceptFight(ctx, sessionId, "p2");

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().p1Id).toBe("p1");

    const session = getFightSession(sessionId);
    expect(session?.status).toBe("active");
    expect(profileStore.get("p1")?.isFighting).toBe(true);
    expect(profileStore.get("p2")?.isFighting).toBe(true);
  });

  test("rejects when session not found", async () => {
    const result = await acceptFight(ctx, "nonexistent", "p2");
    if (result.isOk()) throw new Error("Expected error but got Ok");
    const err = result.error as InstanceType<typeof FightError>;
    expect(err.code).toBe("SESSION_NOT_FOUND");
  });

  test("rejects when wrong player accepts", async () => {
    const { sessionId } = (await initiateFight(ctx, "p1", "p2")).unwrap();
    const result = await acceptFight(ctx, sessionId, "p1");
    expect(result.isErr()).toBe(true);
    const err = result.error as InstanceType<typeof FightError>;
    expect(err.code).toBe("NOT_YOUR_FIGHT");
  });
});

describe("submitMove", () => {
  beforeEach(resetAll);

  async function startActiveFight(): Promise<string> {
    const { sessionId } = (await initiateFight(ctx, "p1", "p2")).unwrap();
    await acceptFight(ctx, sessionId, "p2");
    return sessionId;
  }

  test("waits for both moves before resolving round", async () => {
    const sessionId = await startActiveFight();

    const r1 = await submitMove(ctx, sessionId, "p1", "attack");
    expect(r1.isOk()).toBe(true);
    expect(r1.unwrap().roundResolved).toBe(false);
  });

  test("resolves round when both players submit moves", async () => {
    const sessionId = await startActiveFight();

    await submitMove(ctx, sessionId, "p1", "attack");
    const r2 = await submitMove(ctx, sessionId, "p2", "attack");

    expect(r2.isOk()).toBe(true);
    const data = r2.unwrap();
    expect(data.roundResolved).toBe(true);
    expect(data.round).toBeDefined();
    const round = data.round;
    if (!round) throw new Error("Expected resolved round data");
    expect(round.roundNumber).toBe(1);

    const session = getFightSession(sessionId);
    if (!data.combatEnded) {
      expect(session?.p1Hp).toBeLessThanOrEqual(100);
      expect(session?.p2Hp).toBeLessThanOrEqual(100);
      expect(session?.currentRound).toBe(2);
    }
  });

  test("rejects when player submits move twice in same round", async () => {
    const sessionId = await startActiveFight();
    await submitMove(ctx, sessionId, "p1", "attack");

    const result = await submitMove(ctx, sessionId, "p1", "block");
    if (result.isOk()) throw new Error("Expected error but got Ok");
    const err = result.error as InstanceType<typeof FightError>;
    expect(err.code).toBe("ALREADY_MOVED");
  });

  test("rejects when outsider submits move", async () => {
    const sessionId = await startActiveFight();
    const result = await submitMove(ctx, sessionId, "outsider", "attack");
    if (result.isOk()) throw new Error("Expected error but got Ok");
    const err = result.error as InstanceType<typeof FightError>;
    expect(err.code).toBe("NOT_YOUR_FIGHT");
  });

  test("ends combat when a player reaches 0 HP", async () => {
    const { sessionId } = (
      await initiateFight(ctx, "p1", "p2", {
        p1Stats: { atk: 1000, def: 0, maxHp: 10 },
        p2Stats: { atk: 1000, def: 0, maxHp: 10 },
      })
    ).unwrap();
    await acceptFight(ctx, sessionId, "p2");

    await submitMove(ctx, sessionId, "p1", "attack");
    const result = await submitMove(ctx, sessionId, "p2", "attack");

    expect(result.isOk()).toBe(true);
    const data = result.unwrap();
    expect(data.combatEnded).toBe(true);
    expect(data.combatResult).toBeDefined();
    const combatResult = data.combatResult;
    if (!combatResult) throw new Error("Expected combat result");
    expect(combatResult.winnerId).toBeDefined();
    expect(combatResult.loserId).toBeDefined();
    expect(profileStore.get("p1")?.isFighting).toBe(false);
    expect(profileStore.get("p2")?.isFighting).toBe(false);
  });
});

describe("forfeit", () => {
  beforeEach(resetAll);

  test("p1 forfeiting makes p2 the winner", async () => {
    const { sessionId } = (await initiateFight(ctx, "p1", "p2")).unwrap();
    await acceptFight(ctx, sessionId, "p2");

    const result = await forfeit(ctx, sessionId, "p1");

    expect(result.isOk()).toBe(true);
    const combatResult = result.unwrap();
    expect(combatResult.winnerId).toBe("p2");
    expect(combatResult.loserId).toBe("p1");
    expect(profileStore.get("p1")?.isFighting).toBe(false);
    expect(profileStore.get("p2")?.isFighting).toBe(false);
  });

  test("returns SESSION_NOT_FOUND for unknown session", async () => {
    const result = await forfeit(ctx, "nonexistent", "p1");
    if (result.isOk()) throw new Error("Expected error but got Ok");
    const err = result.error as InstanceType<typeof FightError>;
    expect(err.code).toBe("SESSION_NOT_FOUND");
  });

  test("returns NOT_YOUR_FIGHT for non-participant", async () => {
    const { sessionId } = (await initiateFight(ctx, "p1", "p2")).unwrap();
    const result = await forfeit(ctx, sessionId, "outsider");
    if (result.isOk()) throw new Error("Expected error but got Ok");
    const err = result.error as InstanceType<typeof FightError>;
    expect(err.code).toBe("NOT_YOUR_FIGHT");
  });
});
