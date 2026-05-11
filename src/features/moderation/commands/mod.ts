import {
  Colors,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type InteractionReplyOptions,
} from "discord.js";
import type { CommandContext } from "@/core/feature";

export const data = new SlashCommandBuilder()
  .setName("mod")
  .setDescription("Moderation help and workflow guidance")
  .setDMPermission(false)
  .addSubcommand((sub) =>
    sub.setName("help").setDescription("Show moderation setup, daily-use, automod, and safety guidance"),
  );

export function buildModHelpEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(Colors.Blurple)
    .setTitle("Moderation Help")
    .setDescription("Use this as the moderation home base while the deeper audit pipeline is being built.")
    .addFields(
      {
        name: "First setup",
        value: [
          "`/modset panel` - configure logs, appeals, quarantine, verification, and escalation.",
          "`/automod panel` - configure spam, raid, slowmode, whitelist, and regex protections.",
          "`/roles dashboard` - review managed role policy and action limits.",
        ].join("\n"),
      },
      {
        name: "Daily moderation",
        value: [
          "`/warn`, `/mute`, `/kick`, `/ban` - core sanctions.",
          "`/quarantine add` - restrict a user without removing them from the server.",
          "`/case view` and `/cases` - inspect moderation history.",
        ].join("\n"),
      },
      {
        name: "Automod",
        value: [
          "`/automod status` - review enabled protections and report channels.",
          "Automod alerts should be treated as evidence review, not blind punishment.",
        ].join("\n"),
      },
      {
        name: "Safety",
        value: [
          "Use reasons that another moderator can understand later.",
          "Prefer quarantine or timeout when evidence is incomplete.",
          "Destructive actions should have cases, evidence, and a review path.",
        ].join("\n"),
      },
    )
    .setFooter({ text: "Next foundation: unified moderation authorization, action recording, and audit trails." })
    .setTimestamp();
}

export async function execute(
  _interaction: ChatInputCommandInteraction,
  ctx?: CommandContext,
): Promise<void> {
  const payload: InteractionReplyOptions = {
    embeds: [buildModHelpEmbed()],
    flags: MessageFlags.Ephemeral,
  };
  if (ctx) {
    await ctx.respond.send(payload);
    return;
  }
}
