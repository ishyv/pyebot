/**
 * UserSanctions — history of disciplinary actions taken against a user,
 * grouped per-guild.
 *
 * The previous schema was `Record<guildId, SanctionEntry[]>` embedded in
 * the user doc. We preserve that shape here so the `/cases` command can
 * render a per-guild breakdown without joining anything.
 */

import { z } from "zod";
import { component } from "@/framework/component";

export const SanctionType = z.enum(["BAN", "KICK", "TIMEOUT", "WARN", "RESTRICT"]);
export type SanctionTypeValue = z.infer<typeof SanctionType>;

export const SanctionEntry = z.object({
  type: SanctionType,
  description: z.string(),
  date: z
    .string()
    .optional()
    .default(() => new Date().toISOString()),
});
export type SanctionEntryValue = z.infer<typeof SanctionEntry>;

export const UserSanctions = component({
  collection: "user_sanctions",
  schema: z.object({
    /** guildId → list of sanctions issued in that guild. */
    byGuild: z.record(z.string(), z.array(SanctionEntry)).default(() => ({})),
  }),
});

export type UserSanctionsValue = z.infer<typeof UserSanctions.schema>;
