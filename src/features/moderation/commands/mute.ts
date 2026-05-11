import {
  MessageFlags,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import { mute, MUTE_DURATION_CHOICES } from "@/features/moderation/service";

export const data = new SlashCommandBuilder()
  .setName("mute")
  .setDescription("Timeout (mute) a member")
  .addUserOption((opt) =>
    opt.setName("user").setDescription("Member to mute").setRequired(true),
  )
  .addStringOption((opt) =>
    opt
      .setName("duration")
      .setDescription("Timeout duration")
      .setRequired(true)
      .addChoices(
        ...MUTE_DURATION_CHOICES.map((d) => ({ name: d, value: d })),
      ),
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
  const duration = interaction.options.getString("duration", true);
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

  const result = await mute(interaction.guild, moderator, targetMember, duration, reason);

  if (result.isErr()) {
    await interaction.editReply({ content: `Failed: ${result.error.message}` });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(Colors.Yellow)
    .setTitle("Member Muted")
    .setDescription(`**${targetUser.tag}** has been timed out for **${duration}**.`)
    .addFields({ name: "Reason", value: reason })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
