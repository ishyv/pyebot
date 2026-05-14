/**
 * Ticket — a single open ticket, keyed by the Discord channel id.
 *
 * Linked back to its owner and guild for cleanup and audit purposes.
 * Closed tickets are deleted from this collection — if you need history
 * later, log to a separate audit collection on close.
 */

import { z } from "zod";
import { component } from "@/framework/component";

export const Ticket = component({
  collection: "tickets",
  schema: z.object({
    guildId: z.string(),
    ownerId: z.string(),
    category: z.string().default("general"),
    createdAt: z.coerce.date().default(() => new Date()),
  }),
});

export type TicketValue = z.infer<typeof Ticket.schema>;
