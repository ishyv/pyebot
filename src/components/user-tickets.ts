/**
 * UserTickets — the set of currently-open ticket channel ids a user has.
 *
 * The framework keeps this tiny on purpose: we enforce "one open ticket
 * per user per guild" by checking this collection before opening a new
 * one. Closed tickets are removed; long-lived audit logs live in their
 * own collection if/when needed.
 */

import { z } from "zod";
import { component } from "@/framework/component";

export const UserTickets = component({
  collection: "user_tickets",
  schema: z.object({
    openChannelIds: z.array(z.string()).default(() => []),
  }),
});

export type UserTicketsValue = z.infer<typeof UserTickets.schema>;
