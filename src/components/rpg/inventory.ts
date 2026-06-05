/**
 * User-owned RPG inventory stored on the User entity document.
 *
 * Two storage shapes coexist:
 *   - Stackable items: stored as `{ [itemId]: { qty: number } }`.
 *   - Instance items (unique tools with durability): stored as
 *     `{ [itemId]: { instances: [{ instanceId, durability }] } }`.
 *
 * Stackables have no per-unit state, while instance items do. Keeping both
 * shapes avoids wasting space on millions of identical material entries.
 */

import { z } from "zod";
import { User } from "@/components/entities";
import { defineComponent } from "@/framework";

const StackEntry = z.object({ qty: z.number().int().nonnegative().catch(0) });
const InstanceEntry = z.object({
  instances: z
    .array(
      z.object({
        instanceId: z.string(),
        durability: z.number().int().nonnegative().catch(0),
      }),
    )
    .catch(() => []),
});

export const InventorySlot = z.union([StackEntry, InstanceEntry]);
export type InventorySlotValue = z.infer<typeof InventorySlot>;

export const UserInventory = defineComponent(
  User,
  "inventory",
  z.object({
    slots: z.record(z.string(), InventorySlot).default({}),
  }),
);

export type UserInventoryValue = z.infer<typeof UserInventory.schema>;
