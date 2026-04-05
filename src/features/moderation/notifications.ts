/**
 * Moderation notification utilities.
 *
 * Sends DMs to users after moderation actions. All sends are best-effort —
 * failure (e.g. DMs closed) is silently swallowed so callers are unaffected.
 */

import type { User } from "discord.js";
import type { SanctionType } from "@/db/schemas/user";

function actionLabel(action: SanctionType): string {
  switch (action) {
    case "BAN":      return "banned";
    case "KICK":     return "kicked";
    case "TIMEOUT":  return "timed out";
    case "WARN":     return "warned";
    case "RESTRICT": return "restricted";
    case "PARDON":   return "pardoned";
    default:         return action.toLowerCase();
  }
}

export async function dmUser(
  user: User,
  action: SanctionType,
  guildName: string,
  reason: string,
  caseId: string,
): Promise<void> {
  const label = actionLabel(action);
  await user
    .send(`You have been ${label} from ${guildName}. Reason: ${reason}. Case ID: #${caseId}`)
    .catch(() => {});
}
