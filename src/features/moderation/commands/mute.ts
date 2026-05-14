import {
  MessageFlags,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import { mute } from "@/features/moderation/service";
import { parseDuration } from "@/utils/duration";
import { msToHuman } from "@/utils/time";
import { dmUser } from "@/features/moderation/notifications";
import { sendModLog } from "@/features/moderation/modlog";

export const data = new SlashCommandBuilder()
  .setName("mute")
  .setDescription("Timeout (mute) a member")
  .addUserOption((opt) =>
    opt.setName("user").setDescription("Member to mute").setRequired(true),
  )
  .addStringOption((opt) =>
    opt
      .setName("duration")
      .setDescription("Duration (e.g. 10m, 2h, 1d, 7d, 1w — max 28d)")
      .setRequired(true),
  )
  .addStringOption((opt) =>
    opt.setName("reason").setDescription("Reason for the mute").setRequired(true),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral });
    return;
  }

  const targetUser = interaction.options.getUser("user", true);
  const durationStr = interaction.options.getString("duration", true);
  const reason = interaction.options.getString("reason", true);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const durationMs = parseDuration(durationStr);
  if (durationMs === null) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Red)
          .setTitle("Invalid Duration")
          .setDescription("Invalid duration. Valid formats: 10s, 5m, 2h, 3d, 1w (maximum 28 days)"),
      ],
    });
    return;
  }

  const [moderator, targetMember] = await Promise.all([
    interaction.guild.members.fetch(interaction.user.id),
    interaction.guild.members.fetch(targetUser.id).catch(() => null),
  ]);

  if (!targetMember) {
    await interaction.editReply({ content: "That user is not a member of this server." });
    return;
  }

  const result = await mute(interaction.guild, moderator, targetMember, durationMs, reason);

  if (result.isErr()) {
    await interaction.editReply({ content: `Failed: ${result.error.message}` });
    return;
  }

  const modResult = result.unwrap();
  const humanDuration = msToHuman(durationMs);

  await Promise.all([
    dmUser(targetMember.user, "TIMEOUT", interaction.guild.name, reason, modResult.caseId),
    sendModLog(interaction.guild, modResult, { duration: humanDuration }),
  ]);

  const embed = new EmbedBuilder()
    .setColor(Colors.Yellow)
    .setTitle("Member Muted")
    .setDescription(`**${targetUser.tag}** has been timed out for **${humanDuration}**.`)
    .addFields(
      { name: "Reason", value: reason },
      { name: "Case ID", value: `#${modResult.caseId}` },
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
