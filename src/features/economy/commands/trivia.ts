import { ButtonBuilder, ButtonStyle } from "discord.js";
import { MinigameError, startTrivia } from "@/features/economy/minigames";
import { command } from "@/framework";
import { container, row, text, v2Message } from "@/ui/v2";

export default command("trivia")
  .description("Answer a trivia question to win coins")
  .integer("wager", "Amount to wager", { required: true, min: 1 })
  .guildOnly()
  .defer("public")
  .help({ hints: ["/balance", "/work"] })
  .run(async ({ ctx, userId, guildId, options }) => {
    const wager = options.wager;
    const { sessionKey, question } = await startTrivia(ctx, userId, guildId, { baseReward: wager });

    const labels = ["A", "B", "C", "D"];
    const buttons = question.options.map((option, i) =>
      new ButtonBuilder()
        .setCustomId(`trivia_answer:${sessionKey}:${i}`)
        .setLabel(`${labels[i]}: ${option.length > 75 ? `${option.slice(0, 75)}…` : option}`)
        .setStyle(ButtonStyle.Primary),
    ) as [ButtonBuilder, ...ButtonBuilder[]];

    return v2Message(
      container(
        "info",
        text(
          `## Trivia Question\n${question.question}\n\n-# Wager: ${wager} coins — pick the correct answer!`,
        ),
      ),
      row(...buttons),
    );
  })
  .catch(MinigameError, (err) => ({ content: `Error: ${err.message}` }));
