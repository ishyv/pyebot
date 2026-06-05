/**
 * RpgProfile — a user's RPG-system state.
 *
 * Holds everything specific to the gathering/combat/crafting loop:
 * equipped loadout, current HP, win/loss record, active fight pointer.
 *
 * Why an embedded loadout (not separate component)?
 * The loadout is read together with the rest of the profile in every
 * RPG interaction; splitting it would always cost two reads instead of
 * one. The boundary is "things touched together stay together."
 */

import { z } from "zod";
import { User } from "@/components/entities";
import { defineComponent } from "@/framework";

export const EquipmentSlot = z.enum([
  "weapon",
  "shield",
  "helmet",
  "chest",
  "pants",
  "boots",
  "ring",
  "necklace",
]);
export type EquipmentSlotValue = z.infer<typeof EquipmentSlot>;

export const EquippedItem = z.object({
  instanceId: z.string(),
  itemId: z.string(),
  durability: z.number(),
});
export type EquippedItemValue = z.infer<typeof EquippedItem>;

export const Loadout = z.object({
  weapon: z.union([z.string(), EquippedItem]).nullable().default(null),
  shield: z.union([z.string(), EquippedItem]).nullable().default(null),
  helmet: z.union([z.string(), EquippedItem]).nullable().default(null),
  chest: z.union([z.string(), EquippedItem]).nullable().default(null),
  pants: z.union([z.string(), EquippedItem]).nullable().default(null),
  boots: z.union([z.string(), EquippedItem]).nullable().default(null),
  ring: z.union([z.string(), EquippedItem]).nullable().default(null),
  necklace: z.union([z.string(), EquippedItem]).nullable().default(null),
});
export type LoadoutValue = z.infer<typeof Loadout>;

export function defaultLoadout(): LoadoutValue {
  return {
    weapon: null,
    shield: null,
    helmet: null,
    chest: null,
    pants: null,
    boots: null,
    ring: null,
    necklace: null,
  };
}

export const StarterKitType = z.enum(["miner", "lumber"]);
export type StarterKitTypeValue = z.infer<typeof StarterKitType>;

export const RpgProfile = defineComponent(
  User,
  "rpgProfile",
  z.object({
    loadout: Loadout.default(() => defaultLoadout()),
    hpCurrent: z.number().int().min(0).default(100),
    wins: z.number().int().min(0).default(0),
    losses: z.number().int().min(0).default(0),
    isFighting: z.boolean().default(false),
    activeFightId: z.string().nullable().default(null),
    starterKitType: StarterKitType.nullable().default(null),
    starterKitClaimedAt: z.coerce.date().nullable().default(null),
    stashSize: z.number().int().min(10).default(20),
    activeExpeditionId: z.string().nullable().default(null),
    createdAt: z.coerce.date().default(() => new Date()),
    updatedAt: z.coerce.date().default(() => new Date()),
    /** Optimistic-concurrency version; bumped on every adjustment. */
    version: z.number().int().nonnegative().default(0),
  }),
);

export type RpgProfileValue = z.infer<typeof RpgProfile.schema>;
