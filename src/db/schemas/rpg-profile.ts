import { z } from "zod";

export const EquipmentSlotSchema = z.enum([
  "weapon", "shield", "helmet", "chest", "pants", "boots", "ring", "necklace",
]);
export type EquipmentSlot = z.infer<typeof EquipmentSlotSchema>;

export const EquippedItemSchema = z.object({
  instanceId: z.string(),
  itemId: z.string(),
  durability: z.number(),
});
export type EquippedItem = z.infer<typeof EquippedItemSchema>;

export const LoadoutSchema = z.object({
  weapon: z.union([z.string(), EquippedItemSchema]).nullable().catch(null),
  shield: z.union([z.string(), EquippedItemSchema]).nullable().catch(null),
  helmet: z.union([z.string(), EquippedItemSchema]).nullable().catch(null),
  chest: z.union([z.string(), EquippedItemSchema]).nullable().catch(null),
  pants: z.union([z.string(), EquippedItemSchema]).nullable().catch(null),
  boots: z.union([z.string(), EquippedItemSchema]).nullable().catch(null),
  ring: z.union([z.string(), EquippedItemSchema]).nullable().catch(null),
  necklace: z.union([z.string(), EquippedItemSchema]).nullable().catch(null),
});
export type Loadout = z.infer<typeof LoadoutSchema>;

export function defaultLoadout(): Loadout {
  return { weapon: null, shield: null, helmet: null, chest: null, pants: null, boots: null, ring: null, necklace: null };
}

const DateSchema = z.coerce.date().catch(() => new Date());

export const StarterKitTypeSchema = z.enum(["miner", "lumber"]);
export type StarterKitType = z.infer<typeof StarterKitTypeSchema>;

export const RpgProfileSchema = z.object({
  loadout: LoadoutSchema.catch(defaultLoadout),
  hpCurrent: z.number().int().min(0).catch(100),
  wins: z.number().int().min(0).catch(0),
  losses: z.number().int().min(0).catch(0),
  isFighting: z.boolean().catch(false),
  activeFightId: z.string().nullable().catch(null),
  starterKitType: StarterKitTypeSchema.nullable().catch(null),
  starterKitClaimedAt: z.coerce.date().nullable().catch(null),
  stashSize: z.number().int().min(10).catch(20), // Initial stash size
  activeExpeditionId: z.string().nullable().catch(null),
  createdAt: DateSchema,
  updatedAt: DateSchema,
  version: z.number().int().nonnegative().catch(0),
});
export type RpgProfileData = z.infer<typeof RpgProfileSchema>;
export type RpgProfilePatch = Partial<RpgProfileData>;
