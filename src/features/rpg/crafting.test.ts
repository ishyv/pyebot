/**
 * Tests for the crafting service (craft function, RECIPES).
 * Mocks @/db/repositories/users — no real DB required.
 */

import { describe, it, expect, mock, beforeEach } from "bun:test";
import { OkResult, ErrResult, Err } from "@/core/result";
import type { User } from "@/db/schemas/user";
import type { CraftingError as CraftingErrorType, CraftingResult } from "./crafting";

// ---------------------------------------------------------------------------
// Mocks — must be set up before importing the module under test
// ---------------------------------------------------------------------------

const mockGetUser = mock(async (_id: string) => OkResult<User | null>(null));
const mockUpdateUserPaths = mock(async (_id: string, _paths: Record<string, unknown>) =>
  OkResult(undefined as void),
);

mock.module("@/db/repositories/users", () => ({
  getUser: mockGetUser,
  updateUserPaths: mockUpdateUserPaths,
}));

// ---------------------------------------------------------------------------
// Import SUT after mocks
// ---------------------------------------------------------------------------

const { craft, RECIPES } = await import("./crafting");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUser(inventory: Record<string, number> = {}): User {
  return {
    _id: "user-1",
    warns: [],
    sanction_history: {},
    openTickets: [],
    currency: {},
    inventory,
  } as unknown as User;
}

function resetMocks() {
  mockGetUser.mockReset();
  mockUpdateUserPaths.mockReset();
  mockGetUser.mockImplementation(async () => OkResult<User | null>(makeUser()));
  mockUpdateUserPaths.mockImplementation(async () => OkResult(undefined as void));
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("RECIPES", () => {
  it("exports a non-empty recipes map", () => {
    expect(Object.keys(RECIPES).length).toBeGreaterThan(0);
    expect(RECIPES.stone_pickaxe).toBeDefined();
    expect(RECIPES.stone_pickaxe.requires).toEqual({ stone: 3 });
  });
});

describe("craft()", () => {
  beforeEach(resetMocks);

  // Test 1: Unknown item ID → RECIPE_NOT_FOUND
  it("returns RECIPE_NOT_FOUND for unknown itemId", async () => {
    const result = await craft("user-1", "dragon_sword");
    expect(result.isErr()).toBe(true);
    const err = (result as Err<CraftingResult, CraftingErrorType>).error;
    expect(err.code).toBe("RECIPE_NOT_FOUND");
    expect(err.message).toContain("dragon_sword");
  });

  // Test 2: getUser fails → USER_NOT_FOUND
  it("returns USER_NOT_FOUND when getUser returns an error", async () => {
    mockGetUser.mockImplementation(async () => ErrResult(new Error("db error")));
    const result = await craft("user-1", "stone_pickaxe");
    expect(result.isErr()).toBe(true);
    const err = (result as Err<CraftingResult, CraftingErrorType>).error;
    expect(err.code).toBe("USER_NOT_FOUND");
  });

  // Test 2b: getUser returns null → USER_NOT_FOUND
  it("returns USER_NOT_FOUND when user does not exist (null)", async () => {
    mockGetUser.mockImplementation(async () => OkResult<User | null>(null));
    const result = await craft("user-1", "stone_pickaxe");
    expect(result.isErr()).toBe(true);
    const err = (result as Err<CraftingResult, CraftingErrorType>).error;
    expect(err.code).toBe("USER_NOT_FOUND");
  });

  // Test 3: Insufficient materials
  it("returns INSUFFICIENT_MATERIALS when not enough materials (need 3 stone, have 2)", async () => {
    mockGetUser.mockImplementation(async () =>
      OkResult<User | null>(makeUser({ stone: 2 })),
    );
    const result = await craft("user-1", "stone_pickaxe");
    expect(result.isErr()).toBe(true);
    const err = (result as Err<CraftingResult, CraftingErrorType>).error;
    expect(err.code).toBe("INSUFFICIENT_MATERIALS");
    expect(err.message).toContain("stone");
    expect(err.message).toContain("3"); // needed
    expect(err.message).toContain("2"); // have
  });

  // Test 4: Exact materials available → success
  it("succeeds with exact materials and returns correct materialsConsumed", async () => {
    mockGetUser.mockImplementation(async () =>
      OkResult<User | null>(makeUser({ stone: 3 })),
    );
    const result = await craft("user-1", "stone_pickaxe");
    expect(result.isOk()).toBe(true);
    const data = result.unwrap();
    expect(data.itemId).toBe("stone_pickaxe");
    expect(data.quantity).toBe(1);
    expect(data.materialsConsumed).toEqual({ stone: 3 });

    // Verify inventory deduction calls
    expect(mockUpdateUserPaths).toHaveBeenCalledTimes(1);
    const [calledUserId, calledPaths] = mockUpdateUserPaths.mock.calls[0] as [
      string,
      Record<string, number>,
    ];
    expect(calledUserId).toBe("user-1");
    expect(calledPaths["inventory.stone"]).toBe(0); // 3 - 3 = 0
    expect(calledPaths["inventory.stone_pickaxe"]).toBe(1); // 0 + 1
  });

  // Test 5: Quantity > 1 (craft 2 stone_pickaxe)
  it("doubles material consumption when quantity=2", async () => {
    mockGetUser.mockImplementation(async () =>
      OkResult<User | null>(makeUser({ stone: 7 })),
    );
    const result = await craft("user-1", "stone_pickaxe", 2);
    expect(result.isOk()).toBe(true);
    const data = result.unwrap();
    expect(data.quantity).toBe(2);
    expect(data.materialsConsumed).toEqual({ stone: 6 }); // 3 * 2

    const [, calledPaths] = mockUpdateUserPaths.mock.calls[0] as [
      string,
      Record<string, number>,
    ];
    expect(calledPaths["inventory.stone"]).toBe(1); // 7 - 6 = 1
    expect(calledPaths["inventory.stone_pickaxe"]).toBe(2);
  });

  // Test 6: Different recipes work (copper_pickaxe vs stone_pickaxe)
  it("correctly crafts copper_pickaxe using copper_ingot", async () => {
    mockGetUser.mockImplementation(async () =>
      OkResult<User | null>(makeUser({ copper_ingot: 5 })),
    );
    const result = await craft("user-1", "copper_pickaxe");
    expect(result.isOk()).toBe(true);
    const data = result.unwrap();
    expect(data.itemId).toBe("copper_pickaxe");
    expect(data.materialsConsumed).toEqual({ copper_ingot: 3 });

    const [, calledPaths] = mockUpdateUserPaths.mock.calls[0] as [
      string,
      Record<string, number>,
    ];
    expect(calledPaths["inventory.copper_ingot"]).toBe(2); // 5 - 3 = 2
    expect(calledPaths["inventory.copper_pickaxe"]).toBe(1);
  });

  // Additional: insufficient for quantity > 1
  it("returns INSUFFICIENT_MATERIALS when quantity*required exceeds inventory", async () => {
    mockGetUser.mockImplementation(async () =>
      OkResult<User | null>(makeUser({ stone: 5 })),
    );
    const result = await craft("user-1", "stone_pickaxe", 2); // needs 6, have 5
    expect(result.isErr()).toBe(true);
    const err = (result as Err<CraftingResult, CraftingErrorType>).error;
    expect(err.code).toBe("INSUFFICIENT_MATERIALS");
  });
});
