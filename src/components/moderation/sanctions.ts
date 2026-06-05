/**
 * Moderation state attached to a Discord user.
 *
 * The field names intentionally match the existing `users` document shape so
 * this migration repoints code without orphaning current moderation history.
 */

import { z } from "zod";
import { User } from "@/components/entities";
import { ModNoteSchema, SanctionHistoryEntrySchema } from "@/db/schemas/user";
import { defineComponent } from "@/framework";

export const UserSanctionHistory = defineComponent(
  User,
  "sanction_history",
  z.record(z.string(), z.array(SanctionHistoryEntrySchema)).default({}),
);

export type UserSanctionHistoryValue = z.infer<typeof UserSanctionHistory.schema>;

export const UserModNotes = defineComponent(
  User,
  "mod_notes",
  z
    .record(
      z.string(),
      z.array(ModNoteSchema).catch(() => []),
    )
    .default({}),
);

export type UserModNotesValue = z.infer<typeof UserModNotes.schema>;

export const UserQuarantineRoles = defineComponent(
  User,
  "quarantine_roles",
  z
    .record(
      z.string(),
      z.array(z.string()).catch(() => []),
    )
    .default({}),
);

export type UserQuarantineRolesValue = z.infer<typeof UserQuarantineRoles.schema>;
