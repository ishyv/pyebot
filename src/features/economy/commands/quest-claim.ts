import {
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import { claimRewards } from "@/features/economy/quests";

export const data = new SlashCommandBuilder()
  .setName("quest-claim")
  .setDescription("Claim rewards for a completed quest")
  .addStringOption((opt) =>
    opt.setName("quest_id").setDescription("Quest ID to claim rewards for").setRequired(true),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const questId = interaction.options.getString("quest_id", true);
  const userId = interaction.user.id;

  const result = await claimRewards(userId, questId);

  if (result.isErr()) {
    await interaction.editReply({ content: `Error: ${result.error.message}` });
    return;
  }

  const { rewards } = result.unwrap();

  const embed = new EmbedBuilder()
    .setColor(Colors.Gold)
    .setTitle("Rewards Claimed!")
    .setDescription(`Quest **${questId}** rewards collected.`);

  for (const reward of rewards) {
    embed.addFields({
      name: reward.type === "currency" ? "Currency" : "XP",
      value: reward.description,
      inline: true,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}
