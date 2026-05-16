import { type ButtonInteraction, MessageFlags } from "discord.js";
import { answerTrivia, MinigameError } from "@/features/economy/minigames";
import { Handle } from "@/framework/decorators";
import type { Ctx } from "@/framework/types";
import { container, text, v2Message } from "@/ui/v2";

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
      await interaction.reply({
        content: "This is not your trivia session.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferUpdate();

    try {
      const { correct, reward, newBalance } = await answerTrivia(ctx, sessionKey, answerIndex);

      const payload = correct
        ? v2Message(
            container(
              "ok",
              text(
                `## Correct!\nYou earned **${reward} coins**! New balance: **${newBalance} coins**`,
              ),
            ),
          )
        : v2Message(
            container(
              "danger",
              text(`## Wrong!\nBetter luck next time. New balance: **${newBalance} coins**`),
            ),
          );

      await interaction.editReply({ ...payload, components: payload.components as any[] });
    } catch (err) {
      const msg = err instanceof MinigameError ? err.message : "An error occurred.";
      await interaction.editReply({ content: `Trivia error: ${msg}`, components: [] });
    }
  }
}
