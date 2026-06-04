import { MessageFlags } from "discord.js";
import { answerTrivia, MinigameError } from "@/features/economy/minigames";
import { routes } from "@/features/economy/routes";
import { defineHandlers, routeHandlers } from "@/framework";
import { container, text, v2Message } from "@/ui/v2";

export default defineHandlers([
  ...routeHandlers(routes, {
    // args: { user, guild, index } — decoded and typed from the route schema.
    trivia: async (interaction, args, ctx) => {
      if (args.user !== interaction.user.id) {
        await interaction.reply({
          content: "This is not your trivia session.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.deferUpdate();

      const sessionKey = `${args.user}:${args.guild}`;
      try {
        const { correct, reward, newBalance } = await answerTrivia(ctx, sessionKey, args.index);

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

        // biome-ignore lint/suspicious/noExplicitAny: V2 component builders valid at runtime; discord.js editReply types lag.
        await interaction.editReply({ ...payload, components: payload.components as any[] });
      } catch (err) {
        const msg = err instanceof MinigameError ? err.message : "An error occurred.";
        await interaction.editReply({ content: `Trivia error: ${msg}`, components: [] });
      }
    },
  }),
]);
