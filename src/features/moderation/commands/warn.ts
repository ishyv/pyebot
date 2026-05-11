import {
  MessageFlags,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import { warn } from "@/features/moderation/service";

export const data = new SlashCommandBuilder()
  .setName("warn")
  .setDescription("Issue a warning to a member")
  .addUserOption((opt) =>
    opt.setName("user").setDescription("Member to warn").setRequired(true),
  )
  .addStringOption((opt) =>
    opt.setName("reason").setDescription("Reason for the warning").setRequired(true),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral });
    return;
  }

  const targetUser = interaction.options.getUser("user", true);
  const reason = interaction.options.getString("reason", true);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const [moderator, targetMember] = await Promise.all([
    interaction.guild.members.fetch(interaction.user.id),
    interaction.guild.members.fetch(targetUser.id).catch(() => null),
  ]);

  if (!targetMember) {
    await interaction.editReply({ content: "That user is not a member of this server." });
    return;
  }

  const result = await warn(interaction.guild, moderator, targetMember, reason);

  if (result.isErr()) {
    await interaction.editReply({ content: `Failed: ${result.error.message}` });
    return;
  }

  // Attempt to DM the warned user
  await targetUser.send(
    `You have received a warning in **${interaction.guild.name}**.\n**Reason:** ${reason}`,
  ).catch(() => {});

  const embed = new EmbedBuilder()
    .setColor(Colors.Yellow)
    .setTitle("Warning Issued")
    .setDescription(`**${targetUser.tag}** has been warned.`)
    .addFields({ name: "Reason", value: reason })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
