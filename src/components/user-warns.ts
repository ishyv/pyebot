/**
 * UserWarns — moderation warnings a user has accumulated.
 *
 * Stored separately from sanctions because warns and sanctions have
 * different semantics: a warn is a record; a sanction is an action. They
 * are read in different commands (`/warn`, `/cases`) and would only
 * artificially share a document if combined.
 */

import { z } from "zod";
import { component } from "@/framework/component";

export const Warn = z.object({
  reason: z.string().default(""),
  warn_id: z.string(),
  moderator: z.string(),
  timestamp: z.string(),
});
export type WarnValue = z.infer<typeof Warn>;

export const UserWarns = component({
  collection: "user_warns",
  schema: z.object({
    warns: z.array(Warn).default(() => []),
  }),
});

export type UserWarnsValue = z.infer<typeof UserWarns.schema>;
