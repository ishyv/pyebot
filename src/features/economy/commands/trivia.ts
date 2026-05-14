import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import type { Ctx } from "@/framework/types";
import { startTrivia, MinigameError } from "@/features/economy/minigames";

export const data = new SlashCommandBuilder()
  .setName("trivia")
  .setDescription("Answer a trivia question to win coins")
  .addIntegerOption((opt) =>
    opt.setName("wager").setDescription("Amount to wager").setRequired(true).setMinValue(1),
  );

export async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  await interaction.deferReply();

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const wager = interaction.options.getInteger("wager", true);

  try {
    const { sessionKey, question } = await startTrivia(ctx, interaction.user.id, interaction.guild.id, { baseReward: wager });

    const labels = ["A", "B", "C", "D"];
    const buttons = question.options.map((option, i) =>
      new ButtonBuilder()
        .setCustomId(`trivia_answer:${sessionKey}:${i}`)
        .setLabel(`${labels[i]}: ${option.length > 75 ? `${option.slice(0, 75)}…` : option}`)
        .setStyle(ButtonStyle.Primary),
    );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);

    const embed = new EmbedBuilder()
      .setColor(Colors.Blurple)
      .setTitle("Trivia Question")
      .setDescription(question.question)
      .setFooter({ text: `Wager: ${wager} coins — pick the correct answer!` });

    await interaction.editReply({ embeds: [embed], components: [row] });
  } catch (err) {
    const msg = err instanceof MinigameError ? err.message : "An error occurred.";
    await interaction.editReply({ content: `Error: ${msg}` });
  }
}
