import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import { unban } from "@/features/moderation/service";
import { sendModLog } from "../modlog";

export const data = new SlashCommandBuilder()
  .setName("unban")
  .setDescription("Unban a user from this server")
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .setDMPermission(false)
  .addStringOption((opt) =>
    opt
      .setName("user_id")
      .setDescription("Discord user ID of the banned user")
      .setRequired(true),
  )
  .addStringOption((opt) =>
    opt
      .setName("reason")
      .setDescription("Reason for unbanning")
      .setRequired(false),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild || !interaction.member) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const userId = interaction.options.getString("user_id", true).trim();
  const reason = interaction.options.getString("reason") ?? "No reason provided";

  if (!/^\d{17,19}$/.test(userId)) {
    const embed = new EmbedBuilder()
      .setColor(Colors.Red)
      .setDescription("Invalid user ID. Please provide a valid Discord snowflake (17–19 digits).");
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  try {
    await interaction.guild.bans.fetch(userId);
  } catch {
    const embed = new EmbedBuilder()
      .setColor(Colors.Red)
      .setDescription("That user is not currently banned.");
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const moderator = await interaction.guild.members.fetch(interaction.user.id);

  const result = await unban(interaction.guild, moderator, userId, reason);

  if (result.isErr()) {
    const embed = new EmbedBuilder()
      .setColor(Colors.Red)
      .setDescription(`Failed: ${result.error.message}`);
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const sanctionResult = result.unwrap();

  await sendModLog(interaction.guild, sanctionResult);

  const embed = new EmbedBuilder()
    .setColor(Colors.Green)
    .setTitle("User Unbanned")
    .setDescription(`User <@${userId}> (ID: ${userId}) has been unbanned.`)
    .addFields(
      { name: "Reason", value: reason },
      { name: "Case ID", value: `#${sanctionResult.caseId}`, inline: true },
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
