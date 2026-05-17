/**
 * Tests for getEquippedToolTier and TOOL_TIER_FALLBACK in gathering.ts.
 * Mocks @/db/repositories/users — no real DB required.
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";
import { ErrResult, OkResult } from "@/core/result";
import type { Loadout } from "@/db/schemas/rpg-profile";
import type { User } from "@/db/schemas/user";

// ---------------------------------------------------------------------------
// Mocks — must be set up before importing the module under test
// ---------------------------------------------------------------------------

const mockGetUser = mock(async (_id: string) => OkResult<User | null>(null));

mock.module("@/db/repositories/users", () => ({
  getUser: mockGetUser,
  updateUserPaths: mock(async () => OkResult(undefined as undefined)),
  userStore: {},
}));

// Also mock the rpg repository (transitively imported by gathering.ts)
mock.module("@/db/repositories/rpg", () => ({
  ensureRpgProfile: mock(async () => ErrResult(new Error("not used"))),
  patchRpgProfile: mock(async () => ErrResult(new Error("not used"))),
  rpgStore: {},
}));

// ---------------------------------------------------------------------------
// Import SUT after mocks
// ---------------------------------------------------------------------------

import { parseLocationForAction, parseLocationId } from "@/features/rpg/content/locations";
import { parseToolId, toolTier } from "@/features/rpg/content/tools";
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
// Pure boundary helpers — no mocks needed
// ---------------------------------------------------------------------------

describe("toolTier (pure)", () => {
  test("known tool returns its tier", () => {
    expect(toolTier("starter_pickaxe")).toBe(1);
    expect(toolTier("stone_pickaxe")).toBe(2);
    expect(toolTier("copper_axe")).toBe(3);
    expect(toolTier("iron_pickaxe")).toBe(4);
  });

  test("unknown tool returns TOOL_TIER_FALLBACK", () => {
    expect(toolTier("dragon_pickaxe")).toBe(TOOL_TIER_FALLBACK);
    expect(toolTier(null)).toBe(TOOL_TIER_FALLBACK);
    expect(toolTier(undefined)).toBe(TOOL_TIER_FALLBACK);
    expect(toolTier("")).toBe(TOOL_TIER_FALLBACK);
  });
});

describe("parseToolId", () => {
  test("returns id for known tools", () => {
    expect(parseToolId("stone_pickaxe")).toBe("stone_pickaxe");
  });

  test("returns null for unknown / empty", () => {
    expect(parseToolId("dragon_pickaxe")).toBeNull();
    expect(parseToolId(null)).toBeNull();
    expect(parseToolId(undefined)).toBeNull();
  });
});

describe("parseLocationId", () => {
  test("returns id for known locations", () => {
    expect(parseLocationId("stone_mine")).toBe("stone_mine");
    expect(parseLocationId("oak_forest")).toBe("oak_forest");
  });

  test("returns null for unknown / empty", () => {
    expect(parseLocationId("atlantis")).toBeNull();
    expect(parseLocationId(undefined)).toBeNull();
  });
});

describe("parseLocationForAction", () => {
  test("accepts a location matching its action", () => {
    expect(parseLocationForAction("stone_mine", "mine")).toBe("stone_mine");
    expect(parseLocationForAction("oak_forest", "forest")).toBe("oak_forest");
  });

  test("rejects a location whose action doesn't match", () => {
    expect(parseLocationForAction("stone_mine", "forest")).toBeNull();
    expect(parseLocationForAction("oak_forest", "mine")).toBeNull();
  });

  test("rejects unknown ids", () => {
    expect(parseLocationForAction("atlantis", "mine")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getEquippedToolTier — async DB-reading wrapper
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

  test("loadout.weapon = stone_pickaxe → returns 2", async () => {
    mockGetUser.mockImplementation(async () =>
      OkResult<User | null>(
        makeUser({ instanceId: "inst-1", itemId: "stone_pickaxe", durability: 50 }),
      ),
    );
    const tier = await getEquippedToolTier("user-1");
    expect(tier).toBe(2);
  });

  test("loadout.weapon = copper_axe → returns 3", async () => {
    mockGetUser.mockImplementation(async () =>
      OkResult<User | null>(
        makeUser({ instanceId: "inst-2", itemId: "copper_axe", durability: 30 }),
      ),
    );
    const tier = await getEquippedToolTier("user-1");
    expect(tier).toBe(3);
  });

  test("loadout.weapon = unknown_item → returns TOOL_TIER_FALLBACK", async () => {
    mockGetUser.mockImplementation(async () =>
      OkResult<User | null>(
        makeUser({ instanceId: "inst-3", itemId: "unknown_item", durability: 10 }),
      ),
    );
    const tier = await getEquippedToolTier("user-1");
    expect(tier).toBe(TOOL_TIER_FALLBACK);
  });
});
