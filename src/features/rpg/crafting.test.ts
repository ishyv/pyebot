/**
 * Tests for the component-backed crafting service.
 */

import { beforeEach, describe, expect, it } from "bun:test";
import type { UserInventoryValue } from "@/components/user-inventory";
import type { Err } from "@/core/result";
import { CRAFTING_RECIPES } from "@/features/rpg/content/recipes";
import type { Ctx } from "@/framework/types";
import type { CraftingError as CraftingErrorType, CraftingResult } from "./crafting";
import { craft } from "./crafting";

function makeCtx(
  slots: UserInventoryValue["slots"] = {},
  options: { failPatch?: boolean; failPatchOnCall?: number } = {},
): { ctx: Ctx; inventory: UserInventoryValue } {
  const inventory: UserInventoryValue = { slots: { ...slots } };
  let patchCalls = 0;
  const ctx = {
    async get() {
      return inventory;
    },
    async ensure() {
      return inventory;
    },
    async patch(
      _id: string,
      _component: unknown,
      patch:
        | Partial<UserInventoryValue>
        | ((current: UserInventoryValue) => Partial<UserInventoryValue>),
    ) {
      patchCalls += 1;
      if (options.failPatch || options.failPatchOnCall === patchCalls) {
        throw new Error("db write failed");
      }
      const partial = typeof patch === "function" ? patch(inventory) : patch;
      Object.assign(inventory, partial);
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
  return { ctx, inventory };
}

describe("CRAFTING_RECIPES", () => {
  it("exports a non-empty recipes map", () => {
    expect(Object.keys(CRAFTING_RECIPES).length).toBeGreaterThan(0);
    expect(CRAFTING_RECIPES.stone_pickaxe).toBeDefined();
    expect(CRAFTING_RECIPES.stone_pickaxe.requires).toEqual({ stone: 3 });
  });
});

describe("craft()", () => {
  let ctx: Ctx;
  let inventory: UserInventoryValue;

  beforeEach(() => {
    const made = makeCtx();
    ctx = made.ctx;
    inventory = made.inventory;
  });

  it("returns RECIPE_NOT_FOUND for unknown itemId", async () => {
    const result = await craft(ctx, "user-1", "dragon_sword");
    expect(result.isErr()).toBe(true);
    const err = (result as Err<CraftingResult, CraftingErrorType>).error;
    expect(err.code).toBe("RECIPE_NOT_FOUND");
    expect(err.message).toContain("dragon_sword");
  });

  it("returns INSUFFICIENT_MATERIALS when not enough materials", async () => {
    ({ ctx } = makeCtx({ stone: { qty: 2 } }));
    const result = await craft(ctx, "user-1", "stone_pickaxe");

    expect(result.isErr()).toBe(true);
    const err = (result as Err<CraftingResult, CraftingErrorType>).error;
    expect(err.code).toBe("INSUFFICIENT_MATERIALS");
    expect(err.message).toContain("stone");
    expect(err.message).toContain("3");
    expect(err.message).toContain("2");
  });

  it("succeeds with exact materials and updates component inventory", async () => {
    ({ ctx, inventory } = makeCtx({ stone: { qty: 3 } }));
    const result = await craft(ctx, "user-1", "stone_pickaxe");

    expect(result.isOk()).toBe(true);
    const data = result.unwrap();
    expect(data.itemId).toBe("stone_pickaxe");
    expect(data.quantity).toBe(1);
    expect(data.materialsConsumed).toEqual({ stone: 3 });
    expect(inventory.slots.stone).toEqual({ qty: 0 });
    expect(inventory.slots.stone_pickaxe).toEqual({ qty: 1 });
  });

  it("doubles material consumption when quantity is 2", async () => {
    ({ ctx, inventory } = makeCtx({ stone: { qty: 7 } }));
    const result = await craft(ctx, "user-1", "stone_pickaxe", 2);

    expect(result.isOk()).toBe(true);
    const data = result.unwrap();
    expect(data.quantity).toBe(2);
    expect(data.materialsConsumed).toEqual({ stone: 6 });
    expect(inventory.slots.stone).toEqual({ qty: 1 });
    expect(inventory.slots.stone_pickaxe).toEqual({ qty: 2 });
  });

  it("crafts copper_pickaxe using copper_ingot", async () => {
    ({ ctx, inventory } = makeCtx({ copper_ingot: { qty: 5 } }));
    const result = await craft(ctx, "user-1", "copper_pickaxe");

    expect(result.isOk()).toBe(true);
    const data = result.unwrap();
    expect(data.itemId).toBe("copper_pickaxe");
    expect(data.materialsConsumed).toEqual({ copper_ingot: 3 });
    expect(inventory.slots.copper_ingot).toEqual({ qty: 2 });
    expect(inventory.slots.copper_pickaxe).toEqual({ qty: 1 });
  });

  it("returns INSUFFICIENT_MATERIALS when quantity times requirement exceeds inventory", async () => {
    ({ ctx } = makeCtx({ stone: { qty: 5 } }));
    const result = await craft(ctx, "user-1", "stone_pickaxe", 2);

    expect(result.isErr()).toBe(true);
    const err = (result as Err<CraftingResult, CraftingErrorType>).error;
    expect(err.code).toBe("INSUFFICIENT_MATERIALS");
  });

  it("returns UPDATE_FAILED when component inventory write fails", async () => {
    ({ ctx } = makeCtx({ stone: { qty: 3 } }, { failPatch: true }));
    const result = await craft(ctx, "user-1", "stone_pickaxe");

    expect(result.isErr()).toBe(true);
    const err = (result as Err<CraftingResult, CraftingErrorType>).error;
    expect(err.code).toBe("UPDATE_FAILED");
  });

  it("rolls materials back when crafted output cannot be granted", async () => {
    ({ ctx, inventory } = makeCtx({ stone: { qty: 3 } }, { failPatchOnCall: 2 }));
    const result = await craft(ctx, "user-1", "stone_pickaxe");

    expect(result.isErr()).toBe(true);
    const err = (result as Err<CraftingResult, CraftingErrorType>).error;
    expect(err.code).toBe("UPDATE_FAILED");
    expect(inventory.slots.stone).toEqual({ qty: 3 });
    expect(inventory.slots.stone_pickaxe).toBeUndefined();
  });
});
