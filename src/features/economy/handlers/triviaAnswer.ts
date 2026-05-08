/**
 * Trivia answer button handler.
 *
 * Purpose: Handle button interactions with customId `trivia_answer:{sessionKey}:{answerIndex}`.
 * Called from the interactionCreate handler in index.ts.
 */

import { Colors, EmbedBuilder, MessageFlags, type ButtonInteraction } from "discord.js";
import { answerTrivia } from "@/features/economy/minigames";

export const TRIVIA_BUTTON_PREFIX = "trivia_answer:";

export function isTriviaButton(customId: string): boolean {
  return customId.startsWith(TRIVIA_BUTTON_PREFIX);
}

export async function handleTriviaAnswer(interaction: ButtonInteraction): Promise<void> {
  // customId: "trivia_answer:{sessionKey}:{answerIndex}"
  const parts = interaction.customId.slice(TRIVIA_BUTTON_PREFIX.length).split(":");
  // sessionKey is "{userId}:{guildId}", answerIndex is last segment
  const answerIndex = parseInt(parts[parts.length - 1]!, 10);
  const sessionKey = parts.slice(0, -1).join(":");

  if (isNaN(answerIndex)) {
    await interaction.reply({ content: "Invalid trivia button.", flags: MessageFlags.Ephemeral });
    return;
  }

  // Only the session owner can answer
  if (!sessionKey.startsWith(interaction.user.id)) {
    await interaction.reply({ content: "This is not your trivia session.", flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferUpdate();

  const result = await answerTrivia(sessionKey, answerIndex);

  if (result.isErr()) {
    await interaction.editReply({
      content: `Trivia error: ${result.error.message}`,
      components: [],
    });
    return;
  }

  const { correct, reward, newBalance } = result.unwrap();

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
}
