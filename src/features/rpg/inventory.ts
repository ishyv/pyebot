import { User } from "@/components/entities";
import { UserInventory, type UserInventoryValue } from "@/components/rpg/inventory";
import { ErrResult, OkResult, type Result } from "@/core/result";
import { ensureRpgProfile } from "@/features/rpg/profile";
import type { Ctx } from "@/framework/types";

type InventorySlots = UserInventoryValue["slots"];
type InventorySlot = InventorySlots[string];

export class InventoryError extends Error {
  constructor(
    public readonly code: "STASH_FULL" | "INSUFFICIENT_ITEMS" | "DB_ERROR",
    message: string,
  ) {
    super(message);
    this.name = "InventoryError";
  }
}

/** Returns the stack quantity for a slot; instance-item slots are not stackable. */
export function stackQuantity(slot: InventorySlot | undefined): number {
  if (!slot || !("qty" in slot)) return 0;
  return slot.qty;
}

/**
 * Counts stash usage across stack and instance slots.
 * Stack items count by quantity; instance items count by owned instance count.
 */
export function getStashUsage(slots: InventorySlots): number {
  return Object.values(slots).reduce((sum, slot) => {
    if ("qty" in slot) return sum + slot.qty;
    return sum + slot.instances.length;
  }, 0);
}

/** Reads one stackable item quantity from the component-backed user inventory. */
export async function getStackQuantity(ctx: Ctx, userId: string, itemId: string): Promise<number> {
  const inventory = await ctx.of(User, userId).peek(UserInventory);
  return stackQuantity(inventory?.slots[itemId]);
}

/** Adds stackable items while enforcing the user's RPG stash limit. */
export async function addItemsToStash(
  ctx: Ctx,
  userId: string,
  items: Record<string, number>,
): Promise<Result<{ added: boolean }, InventoryError>> {
  try {
    const profile = await ensureRpgProfile(ctx, userId);
    const user = ctx.of(User, userId);
    const inventory = await user.get(UserInventory);
    const incomingAmount = Object.values(items).reduce((sum, qty) => sum + qty, 0);
    const currentUsage = getStashUsage(inventory.slots);

    if (currentUsage + incomingAmount > profile.stashSize) {
      return ErrResult(
        new InventoryError(
          "STASH_FULL",
          `Stash is full! You have ${currentUsage}/${profile.stashSize} slots. Cannot add ${incomingAmount} more. Upgrade your stash!`,
        ),
      );
    }

    await addStackItems(ctx, userId, items);
    return OkResult({ added: true });
  } catch (error) {
    return ErrResult(new InventoryError("DB_ERROR", errorMessage(error)));
  }
}

/** Adds stackable item quantities, preserving unrelated stack and instance slots. */
export async function addStackItems(
  ctx: Ctx,
  userId: string,
  items: Record<string, number>,
): Promise<void> {
  const positiveItems = Object.entries(items).filter(([, qty]) => qty > 0);
  if (positiveItems.length === 0) return;

  await ctx.of(User, userId).update(UserInventory, (inventory) => {
    const slots = { ...inventory.slots };
    for (const [itemId, qty] of positiveItems) {
      slots[itemId] = { qty: stackQuantity(slots[itemId]) + qty };
    }
    return { slots };
  });
}

/** Removes stackable item quantities after checking every requested stack is available. */
export async function removeStackItems(
  ctx: Ctx,
  userId: string,
  items: Record<string, number>,
): Promise<Result<void, InventoryError>> {
  try {
    const user = ctx.of(User, userId);
    const inventory = await user.get(UserInventory);
    for (const [itemId, qty] of Object.entries(items)) {
      if (qty <= 0) continue;
      const available = stackQuantity(inventory.slots[itemId]);
      if (available < qty) {
        return ErrResult(
          new InventoryError(
            "INSUFFICIENT_ITEMS",
            `Need ${qty}x ${itemId} — you have ${available}x`,
          ),
        );
      }
    }

    await user.update(UserInventory, (current) => {
      const slots = { ...current.slots };
      for (const [itemId, qty] of Object.entries(items)) {
        if (qty <= 0) continue;
        slots[itemId] = { qty: stackQuantity(slots[itemId]) - qty };
      }
      return { slots };
    });
    return OkResult(undefined);
  } catch (error) {
    return ErrResult(new InventoryError("DB_ERROR", errorMessage(error)));
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
