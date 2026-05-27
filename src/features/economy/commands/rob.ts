import { MinigameError, rob } from "@/features/economy/minigames";
import { command } from "@/framework";
import { container, text, v2Message } from "@/ui/v2";

export default command("rob")
  .description("Attempt to rob another user")
  .user("user", "User to rob", { required: true })
  .guildOnly()
  .defer("public")
  .help({ hints: ["/balance"] })
  .run(async ({ ctx, userId, options }) => {
    const target = options.user;
    const { stolenAmount, fineAmount } = await rob(ctx, userId, target.id);

    return stolenAmount > 0
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
  })
  .catch(MinigameError, (err) => ({ content: `Error: ${err.message}` }));
