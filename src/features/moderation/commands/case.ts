import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import { getCaseById, editCase, deleteCase } from "@/features/moderation/service";

const SANCTION_EMOJI: Record<string, string> = {
  BAN: "🔨", KICK: "👢", TIMEOUT: "🔇", WARN: "⚠️", RESTRICT: "🚫",
};

export const data = new SlashCommandBuilder()
  .setName("case")
  .setDescription("Manage a specific moderation case")
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .setDMPermission(false)
  .addSubcommand((sub) =>
    sub
      .setName("view")
      .setDescription("View a case by its ID")
      .addIntegerOption((o) => o.setName("id").setDescription("Case ID").setRequired(true)),
  )
  .addSubcommand((sub) =>
    sub
      .setName("edit")
      .setDescription("Edit the reason on a case")
      .addIntegerOption((o) => o.setName("id").setDescription("Case ID").setRequired(true))
      .addStringOption((o) => o.setName("reason").setDescription("New reason").setRequired(true)),
  )
  .addSubcommand((sub) =>
    sub
      .setName("delete")
      .setDescription("Delete a case record")
      .addIntegerOption((o) => o.setName("id").setDescription("Case ID").setRequired(true)),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  const sub = interaction.options.getSubcommand();
  const caseId = interaction.options.getInteger("id", true);

  if (sub === "view") {
    const result = await getCaseById(interaction.guild.id, caseId);
    if (result.isErr()) {
      await interaction.editReply({ content: "Failed to look up case." });
      return;
    }
    const found = result.unwrap();
    if (!found) {
      await interaction.editReply({ content: `Case #${caseId} not found.` });
      return;
    }
    const { entry, userId } = found;
    const emoji = SANCTION_EMOJI[entry.type] ?? "📝";
    const ts = entry.date ? `<t:${Math.floor(new Date(entry.date).getTime() / 1000)}:F>` : "Unknown";
    const embed = new EmbedBuilder()
      .setColor(Colors.Blurple)
      .setTitle(`Case #${caseId} — ${emoji} ${entry.type}`)
      .addFields(
        { name: "User", value: `<@${userId}>`, inline: true },
        { name: "Moderator", value: entry.moderatorId ? `<@${entry.moderatorId}>` : "Unknown", inline: true },
        { name: "Date", value: ts, inline: true },
        { name: "Reason", value: entry.description },
      )
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  if (sub === "edit") {
    const newReason = interaction.options.getString("reason", true);
    const found = await getCaseById(interaction.guild.id, caseId);
    if (found.isErr() || !found.unwrap()) {
      await interaction.editReply({ content: `Case #${caseId} not found.` });
      return;
    }
    const result = await editCase(found.unwrap()!.userId, interaction.guild.id, caseId, newReason);
    if (result.isErr()) {
      await interaction.editReply({ content: `Failed: ${result.error.message}` });
      return;
    }
    await interaction.editReply({ content: `Case #${caseId} reason updated.` });
    return;
  }

  if (sub === "delete") {
    const found = await getCaseById(interaction.guild.id, caseId);
    if (found.isErr() || !found.unwrap()) {
      await interaction.editReply({ content: `Case #${caseId} not found.` });
      return;
    }
    const result = await deleteCase(found.unwrap()!.userId, interaction.guild.id, caseId);
    if (result.isErr()) {
      await interaction.editReply({ content: `Failed: ${result.error.message}` });
      return;
    }
    await interaction.editReply({ content: `Case #${caseId} deleted.` });
  }
}
