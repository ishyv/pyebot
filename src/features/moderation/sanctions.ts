import { z } from "zod";

/** Stored sanction actions that can appear in user moderation history. */
export const SANCTION_TYPES = ["BAN", "KICK", "TIMEOUT", "WARN", "RESTRICT", "PARDON"] as const;

export type SanctionType = (typeof SANCTION_TYPES)[number];

export const SanctionTypeSchema = z.enum(SANCTION_TYPES);
