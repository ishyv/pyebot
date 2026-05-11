import {
  MessageFlags,
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import { browseQuests } from "@/features/economy/quests";

export const data = new SlashCommandBuilder()
  .setName("quest-list")
  .setDescription("Browse available quests");

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const quests = browseQuests().slice(0, 10);

  const embed = new EmbedBuilder().setColor(Colors.Blurple).setTitle("Available Quests");

  if (quests.length === 0) {
    embed.setDescription("No quests are currently available.");
  } else {
    const lines = quests.map(
      (q) => `**${q.title}** (${q.difficulty}) — ${q.description}`,
    );
    embed.setDescription(lines.join("\n\n"));
  }

  await interaction.editReply({ embeds: [embed] });
}
