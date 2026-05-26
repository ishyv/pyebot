/**
 * Tests for getEquippedToolTier and TOOL_TIER_FALLBACK in gathering.ts.
 * Uses a tiny Ctx stub so profile reads stay on the component path.
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { LoadoutValue, RpgProfileValue } from "@/components/rpg-profile";
import type { Ctx } from "@/framework/types";

// ---------------------------------------------------------------------------
// Mocks — must be set up before importing the module under test
// ---------------------------------------------------------------------------

const mockGetProfile = mock(async (_id: string) => null as RpgProfileValue | null);

mock.module("@/db/repositories/users", () => ({
  getUser: mock(async () => {
    throw new Error("not used");
  }),
  updateUserPaths: mock(async () => {
    throw new Error("not used");
  }),
  userStore: {},
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

function makeCtx(): Ctx {
  return {
    get: (async (id: string) => mockGetProfile(id)) as Ctx["get"],
    ensure: mock(async () => {
      throw new Error("not used");
    }),
    set: mock(async () => undefined),
    patch: mock(async () => undefined),
    delete: mock(async () => undefined),
    query: mock(async () => []),
    emit: mock(async () => undefined),
    client: {} as Ctx["client"],
    logger: { error: mock(() => undefined) } as unknown as Ctx["logger"],
    cooldowns: {} as Ctx["cooldowns"],
    locks: {} as Ctx["locks"],
    sessions: {} as Ctx["sessions"],
    interaction: null,
    respond: {} as Ctx["respond"],
  };
}

function makeProfile(weapon: LoadoutValue["weapon"]): RpgProfileValue {
  return {
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
    stashSize: 20,
    activeExpeditionId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 0,
  };
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
    mockGetProfile.mockReset();
  });

  test("profile read fails → returns TOOL_TIER_FALLBACK", async () => {
    mockGetProfile.mockImplementation(async () => {
      throw new Error("db error");
    });
    const tier = await getEquippedToolTier(makeCtx(), "user-1");
    expect(tier).toBe(TOOL_TIER_FALLBACK);
  });

  test("user has no rpgProfile → returns TOOL_TIER_FALLBACK", async () => {
    mockGetProfile.mockImplementation(async () => null);
    const tier = await getEquippedToolTier(makeCtx(), "user-1");
    expect(tier).toBe(TOOL_TIER_FALLBACK);
  });

  test("loadout.weapon is null → returns TOOL_TIER_FALLBACK", async () => {
    mockGetProfile.mockImplementation(async () => makeProfile(null));
    const tier = await getEquippedToolTier(makeCtx(), "user-1");
    expect(tier).toBe(TOOL_TIER_FALLBACK);
  });

  test("loadout.weapon = stone_pickaxe → returns 2", async () => {
    mockGetProfile.mockImplementation(async () =>
      makeProfile({ instanceId: "inst-1", itemId: "stone_pickaxe", durability: 50 }),
    );
    const tier = await getEquippedToolTier(makeCtx(), "user-1");
    expect(tier).toBe(2);
  });

  test("loadout.weapon = copper_axe → returns 3", async () => {
    mockGetProfile.mockImplementation(async () =>
      makeProfile({ instanceId: "inst-2", itemId: "copper_axe", durability: 30 }),
    );
    const tier = await getEquippedToolTier(makeCtx(), "user-1");
    expect(tier).toBe(3);
  });

  test("loadout.weapon = unknown_item → returns TOOL_TIER_FALLBACK", async () => {
    mockGetProfile.mockImplementation(async () =>
      makeProfile({ instanceId: "inst-3", itemId: "unknown_item", durability: 10 }),
    );
    const tier = await getEquippedToolTier(makeCtx(), "user-1");
    expect(tier).toBe(TOOL_TIER_FALLBACK);
  });
});
