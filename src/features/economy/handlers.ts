import { Colors, EmbedBuilder, MessageFlags, type ButtonInteraction } from "discord.js";
import { Handle } from "@/framework/decorators";
import type { Ctx } from "@/framework/types";
import { answerTrivia, MinigameError } from "@/features/economy/minigames";

export const TRIVIA_BUTTON_PREFIX = "trivia_answer:";

export default class EconomyHandlers {
  @Handle(TRIVIA_BUTTON_PREFIX)
  async triviaAnswer(interaction: ButtonInteraction, ctx: Ctx): Promise<void> {
    const parts = interaction.customId.slice(TRIVIA_BUTTON_PREFIX.length).split(":");
    const answerIndex = parseInt(parts[parts.length - 1]!, 10);
    const sessionKey = parts.slice(0, -1).join(":");

    if (isNaN(answerIndex)) {
      await interaction.reply({ content: "Invalid trivia button.", flags: MessageFlags.Ephemeral });
      return;
    }

    if (!sessionKey.startsWith(interaction.user.id)) {
      await interaction.reply({ content: "This is not your trivia session.", flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferUpdate();

    try {
      const { correct, reward, newBalance } = await answerTrivia(ctx, sessionKey, answerIndex);

      const embed = new EmbedBuilder()
        .setColor(correct ? Colors.Green : Colors.Red)
        .setTitle(correct ? "Correct!" : "Wrong!")
        .setDescription(
          correct
            ? `You earned **${reward} coins**! New balance: **${newBalance} coins**`
            : `Better luck next time. New balance: **${newBalance} coins**`,
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed], components: [] });
    } catch (err) {
      const msg = err instanceof MinigameError ? err.message : "An error occurred.";
      await interaction.editReply({ content: `Trivia error: ${msg}`, components: [] });
    }
  }
}
