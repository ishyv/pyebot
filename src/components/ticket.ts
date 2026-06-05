/**
 * TicketRecord — a single open ticket, stored on the `Ticket` entity (keyed by
 * its Discord channel id).
 *
 * Linked back to its owner and guild for cleanup and audit purposes. Closing a
 * ticket removes the component (and its entity document) — if history is ever
 * needed, log to a separate audit collection on close.
 */

import { z } from "zod";
import { Ticket } from "@/components/entities";
import { defineComponent } from "@/framework";

export const TicketRecord = defineComponent(
  Ticket,
  "ticket",
  z.object({
    guildId: z.string(),
    ownerId: z.string(),
    category: z.string().default("general"),
    createdAt: z.coerce.date().default(() => new Date()),
  }),
);

export type TicketValue = z.infer<typeof TicketRecord.schema>;
