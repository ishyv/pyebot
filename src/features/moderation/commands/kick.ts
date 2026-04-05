import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import { kick } from "@/features/moderation/service";
import { dmUser } from "../notifications";
import { sendModLog } from "../modlog";

export const data = new SlashCommandBuilder()
  .setName("kick")
  .setDescription("Kick a member from the server")
  .addUserOption((opt) =>
    opt.setName("user").setDescription("Member to kick").setRequired(true),
  )
  .addStringOption((opt) =>
    opt.setName("reason").setDescription("Reason for the kick").setRequired(true),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
  .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    return;
  }

  const targetUser = interaction.options.getUser("user", true);
  const reason = interaction.options.getString("reason", true);

  await interaction.deferReply({ ephemeral: true });

  const [moderator, targetMember] = await Promise.all([
    interaction.guild.members.fetch(interaction.user.id),
    interaction.guild.members.fetch(targetUser.id).catch(() => null),
  ]);

  if (!targetMember) {
    await interaction.editReply({ content: "That user is not a member of this server." });
    return;
  }

  const result = await kick(interaction.guild, moderator, targetMember, reason);

  if (result.isErr()) {
    await interaction.editReply({ content: `Failed: ${result.error.message}` });
    return;
  }

  const sanctionResult = result.unwrap();

  await dmUser(targetMember.user, "KICK", interaction.guild.name, reason, sanctionResult.caseId);
  await sendModLog(interaction.guild, sanctionResult);

  const embed = new EmbedBuilder()
    .setColor(Colors.Orange)
    .setTitle("Member Kicked")
    .setDescription(`**${targetUser.tag}** has been kicked.`)
    .addFields(
      { name: "Reason", value: reason },
      { name: "Case ID", value: `#${sanctionResult.caseId}`, inline: true },
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
