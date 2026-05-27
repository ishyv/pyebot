import { MessageFlags } from "discord.js";
import { coinflip, DEFAULT_COINFLIP_CONFIG, MinigameError } from "@/features/economy/minigames";
import { command } from "@/framework";
import type { AccentKey } from "@/ui/theme";
import { container, text, v2Message } from "@/ui/v2";

export interface CoinflipErrorCopy {
  readonly title: string;
  readonly description: string;
  readonly accent: AccentKey;
}

export function coinflipErrorCopy(error: Error): CoinflipErrorCopy {
  if (error instanceof MinigameError) {
    if (error.code === "BET_TOO_LOW") {
      return {
        title: "Minimum Bet",
        description: `Coinflip requires a wager of at least ${DEFAULT_COINFLIP_CONFIG.minBet} coins.`,
        accent: "warn",
      };
    }
    if (error.code === "BET_TOO_HIGH") {
      return {
        title: "Table Limit",
        description: `The current table limit is **${DEFAULT_COINFLIP_CONFIG.maxBet} coins**.`,
        accent: "warn",
      };
    }
    if (error.code === "INSUFFICIENT_FUNDS") {
      return { title: "Not Enough Coins", description: error.message, accent: "warn" };
    }
    if (error.code === "COOLDOWN_ACTIVE") {
      return { title: "Coinflip Cooling Down", description: error.message, accent: "warn" };
    }
  }
  return { title: "Coinflip Unavailable", description: error.message, accent: "danger" };
}

export default command("coinflip")
  .description("Bet coins on a coinflip")
  .integer("amount", "Amount to wager", { required: true, min: DEFAULT_COINFLIP_CONFIG.minBet })
  .string("side", "Side to bet on (default: heads)", {
    choices: [
      { name: "Heads", value: "heads" },
      { name: "Tails", value: "tails" },
    ],
  })
  .guildOnly()
  .help({ hints: ["/balance", "/work"] })
  .run(async ({ ctx, userId, options }) => {
    const amount = options.amount;
    const side = (options.side ?? "heads") as "heads" | "tails";

    if (amount < DEFAULT_COINFLIP_CONFIG.minBet) {
      const copy = coinflipErrorCopy(new MinigameError("BET_TOO_LOW", ""));
      const { components } = v2Message(
        container(copy.accent, text(`## ${copy.title}\n${copy.description}`)),
      );
      return { components, flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral };
    }

    await ctx.respond.defer();

    try {
      const { won, betAmount, winnings, outcome } = await coinflip(ctx, userId, side, amount);
      return won
        ? v2Message(
            container("ok", text(`## You Won!\nYou won **${winnings} coins**! It was ${outcome}.`)),
          )
        : v2Message(
            container(
              "danger",
              text(`## You Lost!\nYou lost **${betAmount} coins**. It was ${outcome}.`),
            ),
          );
    } catch (err) {
      const copy = coinflipErrorCopy(err instanceof Error ? err : new Error(String(err)));
      return v2Message(container(copy.accent, text(`## ${copy.title}\n${copy.description}`)));
    }
  });
