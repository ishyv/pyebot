import {
  MessageFlags,
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
} from "discord.js";
import { startTrivia } from "@/features/economy/minigames";

export const data = new SlashCommandBuilder()
  .setName("trivia")
  .setDescription("Answer a trivia question to win coins")
  .addIntegerOption((opt) =>
    opt.setName("wager").setDescription("Amount to wager").setRequired(true).setMinValue(1),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const wager = interaction.options.getInteger("wager", true);
  const userId = interaction.user.id;
  const guildId = interaction.guild.id;

  const result = await startTrivia(userId, guildId, { baseReward: wager });

  if (result.isErr()) {
    await interaction.editReply({ content: `Error: ${result.error.message}` });
    return;
  }

  const { sessionKey, question } = result.unwrap();

  const labels = ["A", "B", "C", "D"];
  const buttons = question.options.map((option, i) =>
    new ButtonBuilder()
      .setCustomId(`trivia_answer:${sessionKey}:${i}`)
      .setLabel(`${labels[i]}: ${option.length > 75 ? option.slice(0, 75) + "…" : option}`)
      .setStyle(ButtonStyle.Primary),
  );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);

  const embed = new EmbedBuilder()
    .setColor(Colors.Blurple)
    .setTitle("Trivia Question")
    .setDescription(question.question)
    .setFooter({ text: `Wager: ${wager} coins — pick the correct answer!` });

  await interaction.editReply({ embeds: [embed], components: [row] });
}
