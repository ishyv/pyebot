import { ButtonBuilder, ButtonStyle, type ChatInputCommandInteraction } from "discord.js";
import { MinigameError, startTrivia } from "@/features/economy/minigames";
import { command } from "@/framework";
import type { Ctx } from "@/framework/types";
import { container, row, text, v2Message } from "@/ui/v2";

const data = command("trivia")
  .setDescription("Answer a trivia question to win coins")
  .addIntegerOption((opt) =>
    opt.setName("wager").setDescription("Amount to wager").setRequired(true).setMinValue(1),
  );

async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  await ctx.respond.defer();

  if (!interaction.guild) {
    await ctx.respond.send({ content: "This command can only be used in a server." });
    return;
  }

  const wager = interaction.options.getInteger("wager", true);

  try {
    const { sessionKey, question } = await startTrivia(
      ctx,
      interaction.user.id,
      interaction.guild.id,
      { baseReward: wager },
    );

    const labels = ["A", "B", "C", "D"];
    const buttons = question.options.map((option, i) =>
      new ButtonBuilder()
        .setCustomId(`trivia_answer:${sessionKey}:${i}`)
        .setLabel(`${labels[i]}: ${option.length > 75 ? `${option.slice(0, 75)}…` : option}`)
        .setStyle(ButtonStyle.Primary),
    ) as [ButtonBuilder, ...ButtonBuilder[]];

    await ctx.respond.send(
      v2Message(
        container(
          "info",
          text(
            `## Trivia Question\n${question.question}\n\n-# Wager: ${wager} coins — pick the correct answer!`,
          ),
        ),
        row(...buttons),
      ),
    );
  } catch (err) {
    const msg = err instanceof MinigameError ? err.message : "An error occurred.";
    await ctx.respond.send({ content: `Error: ${msg}` });
  }
}

export default data
  .help({ hints: ["/balance", "/work"] })
  .run(({ interaction, ctx }) =>
    (execute as (...args: never[]) => Promise<void>)(interaction as never, ctx as never),
  );
