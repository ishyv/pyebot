import {
  MessageFlags,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import { quarantine, release } from "@/features/moderation/service";

export const data = new SlashCommandBuilder()
  .setName("quarantine")
  .setDescription("Quarantine or release a member")
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .setDMPermission(false)
  .addSubcommand((sub) =>
    sub
      .setName("add")
      .setDescription("Place a member in quarantine")
      .addUserOption((o) => o.setName("user").setDescription("Member to quarantine").setRequired(true))
      .addStringOption((o) => o.setName("reason").setDescription("Reason").setRequired(true)),
  )
  .addSubcommand((sub) =>
    sub
      .setName("release")
      .setDescription("Release a member from quarantine, restoring their roles")
      .addUserOption((o) => o.setName("user").setDescription("Member to release").setRequired(true)),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "Server only.", flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const sub = interaction.options.getSubcommand();
  const targetUser = interaction.options.getUser("user", true);

  const [moderator, targetMember] = await Promise.all([
    interaction.guild.members.fetch(interaction.user.id),
    interaction.guild.members.fetch(targetUser.id).catch(() => null),
  ]);

  if (!targetMember) {
    await interaction.editReply({ content: "That user is not a member of this server." });
    return;
  }

  if (sub === "add") {
    const reason = interaction.options.getString("reason", true);
    const result = await quarantine(interaction.guild, moderator, targetMember, reason);

    if (result.isErr()) {
      await interaction.editReply({ content: `Failed: ${result.error.message}` });
      return;
    }

    const { caseId } = result.unwrap();
    const embed = new EmbedBuilder()
      .setColor(Colors.Purple)
      .setTitle("Member Quarantined")
      .setDescription(`**${targetUser.tag}** has been placed in quarantine.`)
      .addFields(
        { name: "Reason", value: reason },
        { name: "Case", value: `#${caseId}`, inline: true },
      )
      .setFooter({ text: "Use /quarantine release to restore their roles." })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  if (sub === "release") {
    const result = await release(interaction.guild, moderator, targetMember);

    if (result.isErr()) {
      await interaction.editReply({ content: `Failed: ${result.error.message}` });
      return;
    }

    const { restoredRoles } = result.unwrap();
    const embed = new EmbedBuilder()
      .setColor(Colors.Green)
      .setTitle("Member Released")
      .setDescription(`**${targetUser.tag}** has been released from quarantine.`)
      .addFields({ name: "Roles Restored", value: `${restoredRoles}`, inline: true })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}
