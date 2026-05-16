/**
 * Mod Log utility.
 *
 * Sends a formatted Components V2 message to the guild's configured mod log
 * channel after any moderation action. Silently skips if no channel is
 * configured or the send fails — callers must never depend on this for
 * correctness; logging is best-effort by design.
 */

import type { Guild, TextChannel } from "discord.js";
import { createLogger } from "@/core/logger";
import { getGuild } from "@/db/repositories/guilds";
import type { ModerationResult } from "./service";
import { renderModlogCase } from "./views";

const log = createLogger("modlog");

export async function sendModLog(
  guild: Guild,
  result: ModerationResult,
  extras?: { duration?: string; restrictionType?: string; note?: string },
): Promise<void> {
  try {
    const guildResult = await getGuild(guild.id);
    if (guildResult.isErr()) return;
    const guildData = guildResult.unwrap();
    if (!guildData) return;

    const channelId = guildData.channels.core["modlog"]?.channelId;
    if (!channelId) return;

    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased()) return;

    // Resolve target avatar best-effort; falls back to a plain text section if
    // the user is uncacheable or fetch fails.
    const targetAvatarUrl = await resolveAvatar(guild, result.targetId);

    const payload = renderModlogCase({ result, targetAvatarUrl, extras });
    await (channel as TextChannel).send(payload);
  } catch (err) {
    log.error("Failed to send mod log", err);
  }
}

/**
 * Returns the user's CDN avatar URL or `null` when neither cache nor a fetch
 * yields a user object. Best-effort: any error becomes `null` so the modlog
 * send still proceeds with the avatar-less view.
 */
async function resolveAvatar(guild: Guild, userId: string): Promise<string | null> {
  const cached = guild.members.cache.get(userId);
  if (cached) return cached.displayAvatarURL({ size: 128 });
  const user = await guild.client.users.fetch(userId).catch(() => null);
  return user ? user.displayAvatarURL({ size: 128 }) : null;
}
