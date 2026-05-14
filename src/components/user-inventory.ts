/**
 * UserInventory — the items a user owns.
 *
 * Two storage shapes coexist:
 *   - Stackable items: stored as `{ [itemId]: { qty: number } }`.
 *   - Instance items (unique tools with durability): stored as
 *     `{ [itemId]: { instances: [{ instanceId, durability }] } }`.
 *
 * Why both shapes? Stackables are tens of millions of "iron ingot" and
 * have no per-unit state — a count suffices. Instance items have unique
 * state (durability) and must track each one independently. Smushing
 * them into the same shape costs more space than it saves.
 */

import { z } from "zod";
import { component } from "@/framework/component";

const StackEntry = z.object({ qty: z.number().int().nonnegative().catch(0) });
const InstanceEntry = z.object({
  instances: z.array(
    z.object({
      instanceId: z.string(),
      durability: z.number().int().nonnegative().catch(0),
    }),
  ).catch(() => []),
});

export const InventorySlot = z.union([StackEntry, InstanceEntry]);
export type InventorySlotValue = z.infer<typeof InventorySlot>;

export const UserInventory = component({
  collection: "user_inventories",
  schema: z.object({
    slots: z.record(z.string(), InventorySlot).default({}),
  }),
});

export type UserInventoryValue = z.infer<typeof UserInventory.schema>;
