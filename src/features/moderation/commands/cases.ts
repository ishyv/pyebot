import {
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";
import { getCases } from "@/features/moderation/service";
import type { SanctionType } from "@/db/schemas/user";
import { hasPermission } from "@/middleware/permissions";

const SANCTION_EMOJI: Record<SanctionType, string> = {
  BAN: "🔨",
  KICK: "👢",
  TIMEOUT: "🔇",
  WARN: "⚠️",
  RESTRICT: "🚫",
  PARDON: "✅",
};

export const data = new SlashCommandBuilder()
  .setName("cases")
  .setDescription("View the sanction history of a user on this server")
  .addUserOption((opt) =>
    opt.setName("user").setDescription("User to look up (defaults to yourself)").setRequired(false),
  )
  .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    return;
  }

  const targetUser = interaction.options.getUser("user") ?? interaction.user;

  await interaction.deferReply({ ephemeral: true });

  // Privacy gate: only allow viewing other users' history if caller has ModerateMembers
  const isSelf = targetUser.id === interaction.user.id;
  if (!isSelf) {
    const callerMember = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (!callerMember || !hasPermission(callerMember, PermissionFlagsBits.ModerateMembers)) {
      const embed = new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle("Permission Denied")
        .setDescription("You can only view your own case history.")
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }
  }

  const result = await getCases(targetUser.id, interaction.guild.id);

  if (result.isErr()) {
    await interaction.editReply({ content: "Failed to fetch case history." });
    return;
  }

  const history = result.unwrap();

  if (history.length === 0) {
    await interaction.editReply({ content: `**${targetUser.tag}** has no cases recorded on this server.` });
    return;
  }

  // Most recent first, cap at 15
  const entries = [...history].reverse().slice(0, 15);

  const description = entries
    .map((entry, i) => {
      const emoji = SANCTION_EMOJI[entry.type] ?? "📝";
      const ts = entry.date
        ? `<t:${Math.floor(new Date(entry.date).getTime() / 1000)}:d>`
        : "N/A";
      return `**${i + 1}.** ${emoji} **${entry.type}** — ${ts}\n> ${entry.description}`;
    })
    .join("\n\n");

  const embed = new EmbedBuilder()
    .setColor(Colors.Blurple)
    .setTitle(`Case History — ${targetUser.tag}`)
    .setDescription(description)
    .setFooter({ text: `Showing ${entries.length} of ${history.length} cases | ID: ${targetUser.id}` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
