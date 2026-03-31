/**
 * Tests for getEquippedToolTier and TOOL_TIER_FALLBACK in gathering.ts.
 * Mocks @/db/repositories/users and @/content/registry — no real DB required.
 */

import { describe, expect, test, mock, beforeEach } from "bun:test";
import { OkResult, ErrResult } from "@/core/result";
import type { User } from "@/db/schemas/user";
import type { Loadout } from "@/db/schemas/rpg-profile";

// ---------------------------------------------------------------------------
// Mocks — must be set up before importing the module under test
// ---------------------------------------------------------------------------

const mockGetUser = mock(async (_id: string) => OkResult<User | null>(null));

mock.module("@/db/repositories/users", () => ({
  getUser: mockGetUser,
  updateUserPaths: mock(async () => OkResult(undefined as void)),
}));

// No content registry loaded by default
mock.module("@/content/registry", () => ({
  getContentRegistry: () => null,
  resetContentRegistryForTests: () => {},
}));

// Also mock the rpg repository (transitively imported by gathering.ts)
mock.module("@/db/repositories/rpg", () => ({
  ensureRpgProfile: mock(async () => ErrResult(new Error("not used"))),
  patchRpgProfile: mock(async () => ErrResult(new Error("not used"))),
}));

// ---------------------------------------------------------------------------
// Import SUT after mocks
// ---------------------------------------------------------------------------

import { getEquippedToolTier, TOOL_TIER_FALLBACK } from "./gathering";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUser(weapon: Loadout["weapon"]): User {
  return {
    _id: "user-1",
    warns: [],
    sanction_history: {},
    openTickets: [],
    currency: {},
    inventory: {},
    economyAccount: undefined as unknown as User["economyAccount"],
    rpgProfile: {
      loadout: {
        weapon,
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
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 0,
    },
  } as unknown as User;
}

function makeUserNoRpg(): User {
  return {
    _id: "user-1",
    warns: [],
    sanction_history: {},
    openTickets: [],
    currency: {},
    inventory: {},
  } as unknown as User;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TOOL_TIER_FALLBACK", () => {
  test("is 1", () => {
    expect(TOOL_TIER_FALLBACK).toBe(1);
  });
});

describe("getEquippedToolTier", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
  });

  test("getUser fails → returns TOOL_TIER_FALLBACK", async () => {
    mockGetUser.mockImplementation(async () => ErrResult(new Error("db error")));
    const tier = await getEquippedToolTier("user-1");
    expect(tier).toBe(TOOL_TIER_FALLBACK);
  });

  test("user has no rpgProfile → returns TOOL_TIER_FALLBACK", async () => {
    mockGetUser.mockImplementation(async () => OkResult<User | null>(makeUserNoRpg()));
    const tier = await getEquippedToolTier("user-1");
    expect(tier).toBe(TOOL_TIER_FALLBACK);
  });

  test("loadout.weapon is null → returns TOOL_TIER_FALLBACK", async () => {
    mockGetUser.mockImplementation(async () => OkResult<User | null>(makeUser(null)));
    const tier = await getEquippedToolTier("user-1");
    expect(tier).toBe(TOOL_TIER_FALLBACK);
  });

  test("loadout.weapon = { itemId: 'stone_pickaxe', ... } → returns 2", async () => {
    mockGetUser.mockImplementation(async () =>
      OkResult<User | null>(makeUser({ instanceId: "inst-1", itemId: "stone_pickaxe", durability: 50 })),
    );
    const tier = await getEquippedToolTier("user-1");
    expect(tier).toBe(2);
  });

  test("loadout.weapon = { itemId: 'copper_axe', ... } → returns 3", async () => {
    mockGetUser.mockImplementation(async () =>
      OkResult<User | null>(makeUser({ instanceId: "inst-2", itemId: "copper_axe", durability: 30 })),
    );
    const tier = await getEquippedToolTier("user-1");
    expect(tier).toBe(3);
  });

  test("loadout.weapon = { itemId: 'unknown_item' } → returns TOOL_TIER_FALLBACK", async () => {
    mockGetUser.mockImplementation(async () =>
      OkResult<User | null>(makeUser({ instanceId: "inst-3", itemId: "unknown_item", durability: 10 })),
    );
    const tier = await getEquippedToolTier("user-1");
    expect(tier).toBe(TOOL_TIER_FALLBACK);
  });
});
