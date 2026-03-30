import {
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import { acceptQuest } from "@/features/economy/quests";

export const data = new SlashCommandBuilder()
  .setName("quest-accept")
  .setDescription("Accept a quest")
  .addStringOption((opt) =>
    opt.setName("quest_id").setDescription("Quest ID to accept").setRequired(true),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const questId = interaction.options.getString("quest_id", true);
  const userId = interaction.user.id;

  const result = await acceptQuest(userId, questId);

  if (result.isErr()) {
    await interaction.editReply({ content: `Error: ${result.error.message}` });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(Colors.Green)
    .setTitle("Quest Accepted")
    .setDescription(`Quest **${questId}** accepted!`);

  await interaction.editReply({ embeds: [embed] });
}
