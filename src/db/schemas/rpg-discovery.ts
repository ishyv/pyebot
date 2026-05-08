import { z } from "zod";

export const RpgDiscoveredItemSchema = z.object({
  _id: z.string(), // The recipe hash, e.g. "copper_ore_red_herb_stone"
  name: z.string(), // AI generated Name
  ingredients: z.array(z.string()),
  discoveredByUserId: z.string(),
  discoveredAt: z.coerce.date().catch(() => new Date()),
});

export type RpgDiscoveredItem = z.infer<typeof RpgDiscoveredItemSchema>;
