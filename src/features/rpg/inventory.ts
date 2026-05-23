import { ErrResult, OkResult, type Result } from "@/core/result";
import { ensureRpgProfile } from "@/db/repositories/rpg";
import { getUser, updateUserPaths } from "@/db/repositories/users";
import type { UserInventory } from "@/db/schemas/user";

export class InventoryError extends Error {
  constructor(
    public readonly code: "STASH_FULL" | "NOT_FOUND" | "DB_ERROR",
    message: string,
  ) {
    super(message);
    this.name = "InventoryError";
  }
}

/**
 * Calculates current total stack sizes or distinct slots used.
 * Tarkov-style usually limits distinct slots or total weight, but we'll use total items quantity
 * or total distinct item types for simplicity. Let's use total distinct item types for now to allow hoarding of a few items
 * but punish hoarding EVERYTHING (or sum of all quantities, which is harsher).
 * Let's use sum of all item quantities for true harshness (max 20 items total by default).
 */
export function getStashUsage(inventory: UserInventory): number {
  return Object.values(inventory).reduce((sum, qty) => sum + qty, 0);
}

/**
 * Attempts to add items to the user's inventory, respecting the stash limit set in their RPG profile.
 */
export async function addItemsToStash(
  userId: string,
  items: Record<string, number>,
): Promise<Result<{ added: boolean }, InventoryError>> {
  const profileRes = await ensureRpgProfile(userId);
  if (profileRes.isErr())
    return ErrResult(new InventoryError("DB_ERROR", profileRes.error.message));
  const maxStash = profileRes.unwrap().stashSize;

  const userRes = await getUser(userId);
  const user = userRes.isOk() ? userRes.unwrap() : null;
  if (!user) return ErrResult(new InventoryError("NOT_FOUND", "User not found"));

  const currentInventory = user.inventory;
  const currentUsage = getStashUsage(currentInventory);

  const incomingAmount = Object.values(items).reduce((sum, qty) => sum + qty, 0);

  if (currentUsage + incomingAmount > maxStash) {
    return ErrResult(
      new InventoryError(
        "STASH_FULL",
        `Stash is full! You have ${currentUsage}/${maxStash} slots. Cannot add ${incomingAmount} more. Upgrade your stash!`,
      ),
    );
  }

  const paths: Record<string, number> = {};
  for (const [itemId, qty] of Object.entries(items)) {
    const currentQty = currentInventory[itemId] || 0;
    paths[`inventory.${itemId}`] = currentQty + qty;
  }

  const updateRes = await updateUserPaths(userId, paths);
  if (updateRes.isErr()) return ErrResult(new InventoryError("DB_ERROR", updateRes.error.message));

  return OkResult({ added: true });
}
