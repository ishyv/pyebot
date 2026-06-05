/**
 * UserTickets — the open ticket channel ids a user has, grouped per guild.
 *
 * The framework enforces "one open ticket per user per guild" by checking this
 * before opening a new one. Stored on the `User` entity; the old record was
 * keyed `{guildId}:{userId}`, so the guild id moves into the map key here.
 * Closed tickets are removed; long-lived audit logs live elsewhere.
 */

import { z } from "zod";
import { User } from "@/components/entities";
import { defineComponent } from "@/framework";

export const UserTickets = defineComponent(
  User,
  "tickets",
  z.object({
    /** guildId → open ticket channel ids in that guild. */
    openByGuild: z.record(z.string(), z.array(z.string())).default(() => ({})),
  }),
);

export type UserTicketsValue = z.infer<typeof UserTickets.schema>;
