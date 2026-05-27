import type { ChatInputCommandInteraction } from "discord.js";
import { MinigameError, rob } from "@/features/economy/minigames";
import { command } from "@/framework";
import type { Ctx } from "@/framework/types";
import { container, text, v2Message } from "@/ui/v2";

const data = command("rob")
  .setDescription("Attempt to rob another user")
  .addUserOption((opt) => opt.setName("user").setDescription("User to rob").setRequired(true));

async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  await ctx.respond.defer();

  if (!interaction.guild) {
    await ctx.respond.send({ content: "This command can only be used in a server." });
    return;
  }

  const target = interaction.options.getUser("user", true);

  try {
    const { stolenAmount, fineAmount } = await rob(ctx, interaction.user.id, target.id);

    const payload =
      stolenAmount > 0
        ? v2Message(
            container(
              "warn",
              text(
                `## Robbery Successful!\nYou stole **${stolenAmount} coins** from <@${target.id}>!`,
              ),
            ),
          )
        : v2Message(
            container(
              "danger",
              text(`## Caught!\nYou got caught! Lost **${fineAmount} coins** as penalty.`),
            ),
          );

    await ctx.respond.send(payload);
  } catch (err) {
    const msg = err instanceof MinigameError ? err.message : "An error occurred.";
    await ctx.respond.send({ content: `Error: ${msg}` });
  }
}

export default data
  .help({ hints: ["/balance"] })
  .run(({ interaction, ctx }) =>
    (execute as (...args: never[]) => Promise<void>)(interaction as never, ctx as never),
  );
