import type { ButtonBuilder } from "discord.js";
import { MinigameError, startTrivia } from "@/features/economy/minigames";
import { routes } from "@/features/economy/routes";
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
    const { question } = await startTrivia(ctx, userId, guildId, { baseReward: wager });

    const labels = ["A", "B", "C", "D"];
    const buttons = question.options.map((option, i) =>
      routes.trivia.button(
        { user: userId, guild: guildId, index: i },
        { label: `${labels[i]}: ${option.length > 75 ? `${option.slice(0, 75)}…` : option}` },
      ),
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
