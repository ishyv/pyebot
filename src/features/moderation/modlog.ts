/**
 * Mod Log utility.
 *
 * Sends a formatted embed to the guild's configured mod log channel after any
 * moderation action. Silently skips if no channel is configured or the send
 * fails — callers must never depend on this for correctness.
 */

import { type Guild, EmbedBuilder, Colors } from "discord.js";
import { getGuild } from "@/db/repositories/guilds";
import { createLogger } from "@/core/logger";
import type { ModerationResult } from "./service";
import type { SanctionType } from "@/db/schemas/user";

const log = createLogger("modlog");

function colorForAction(type: SanctionType): number {
  switch (type) {
    case "BAN":     return Colors.Red;
    case "KICK":    return Colors.Orange;
    case "TIMEOUT": return Colors.Yellow;
    case "WARN":    return Colors.Yellow;
    case "RESTRICT": return Colors.Blue;
    case "PARDON":  return Colors.Green;
    default:        return Colors.Grey;
  }
}

export async function sendModLog(
  guild: Guild,
  result: ModerationResult,
  extras?: { duration?: string; restrictionType?: string },
): Promise<void> {
  try {
    const guildResult = await getGuild(guild.id);
    if (guildResult.isErr()) return;
    const guildData = guildResult.unwrap();
    if (!guildData) return;

    const channelId = guildData.channels.core["modlog"]?.channelId;
    if (!channelId) return;

    let channel: Awaited<ReturnType<typeof guild.channels.fetch>>;
    try {
      channel = await guild.channels.fetch(channelId);
    } catch {
      return;
    }

    if (!channel?.isTextBased() || !("send" in channel)) return;

    const embed = new EmbedBuilder()
      .setColor(colorForAction(result.type))
      .setTitle(`Case #${result.caseId} — ${result.type}`)
      .addFields(
        { name: "Target",    value: `<@${result.targetId}> (ID: ${result.targetId})` },
        { name: "Moderator", value: `<@${result.moderatorId}>` },
        { name: "Reason",    value: result.reason },
      )
      .setTimestamp(new Date());

    if (extras?.duration) {
      embed.addFields({ name: "Duration", value: extras.duration });
    }

    if (extras?.restrictionType) {
      embed.addFields({ name: "Restriction", value: extras.restrictionType });
    }

    await channel.send({ embeds: [embed] });
  } catch (err) {
    log.error("Failed to send mod log", err);
  }
}
