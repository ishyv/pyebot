import { z } from "zod";

/**
 * Temporary ban record stored in the `temp_bans` MongoDB collection.
 * _id is `${guildId}:${userId}` — one active temp ban per user per guild.
 */
export const TempBanSchema = z.object({
  _id: z.string(),
  guildId: z.string(),
  userId: z.string(),
  reason: z.string(),
  moderatorId: z.string(),
  unbanAt: z.coerce.date(),
  bannedAt: z.coerce.date(),
});

export type TempBan = z.infer<typeof TempBanSchema>;
