import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import { ban } from "@/features/moderation/service";
import { dmUser } from "../notifications";
import { sendModLog } from "../modlog";

export const data = new SlashCommandBuilder()
  .setName("ban")
  .setDescription("Ban a user from the server")
  .addUserOption((opt) =>
    opt.setName("user").setDescription("User to ban").setRequired(true),
  )
  .addStringOption((opt) =>
    opt.setName("reason").setDescription("Reason for the ban").setRequired(true),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild || !interaction.member) {
    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    return;
  }

  const target = interaction.options.getUser("user", true);
  const reason = interaction.options.getString("reason", true);
  const moderator = await interaction.guild.members.fetch(interaction.user.id);

  await interaction.deferReply({ ephemeral: true });

  const result = await ban(interaction.guild, moderator, target, reason);

  if (result.isErr()) {
    await interaction.editReply({ content: `Failed: ${result.error.message}` });
    return;
  }

  const sanctionResult = result.unwrap();

  // Send DM after successful ban — User objects can be DMed post-ban
  // even though the user is no longer on the server
  await dmUser(target, "BAN", interaction.guild.name, reason, sanctionResult.caseId);
  await sendModLog(interaction.guild, sanctionResult);

  const embed = new EmbedBuilder()
    .setColor(Colors.Red)
    .setTitle("User Banned")
    .setDescription(`**${target.tag}** has been banned.`)
    .addFields(
      { name: "Reason", value: reason },
      { name: "Case ID", value: `#${sanctionResult.caseId}`, inline: true },
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
