import { z } from "zod";
import { SanctionTypeSchema } from "@/features/moderation/sanctions";

export const SanctionType = SanctionTypeSchema;
export type SanctionType = z.infer<typeof SanctionType>;

export const SanctionHistoryEntrySchema = z.object({
  type: SanctionType,
  description: z.string(),
  date: z
    .string()
    .optional()
    .catch(() => new Date().toISOString()),
  caseId: z
    .number()
    .int()
    .optional()
    .catch(() => undefined),
  moderatorId: z
    .string()
    .optional()
    .catch(() => undefined),
  moderatorRoleIds: z
    .array(z.string())
    .optional()
    .catch(() => undefined),
  source: z
    .enum(["manual", "automod", "appeal", "escalation", "system"])
    .optional()
    .catch(() => undefined),
  evidenceSummary: z
    .string()
    .optional()
    .catch(() => undefined),
});
export type SanctionHistoryEntry = z.infer<typeof SanctionHistoryEntrySchema>;

export const ModNoteSchema = z.object({
  note: z.string(),
  moderatorId: z.string(),
  createdAt: z.string(),
});
export type ModNote = z.infer<typeof ModNoteSchema>;

export const UserSchema = z.object({
  _id: z.string(),
  sanction_history: z.record(z.string(), z.array(SanctionHistoryEntrySchema)).catch(() => ({})),
  mod_notes: z
    .record(
      z.string(),
      z.array(ModNoteSchema).catch(() => []),
    )
    .catch(() => ({})),
  quarantine_roles: z
    .record(
      z.string(),
      z.array(z.string()).catch(() => []),
    )
    .catch(() => ({})),
  createdAt: z.coerce
    .date()
    .optional()
    .catch(() => undefined),
  updatedAt: z.coerce
    .date()
    .optional()
    .catch(() => undefined),
});
export type User = z.infer<typeof UserSchema>;
