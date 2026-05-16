import { type ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { coinflip, DEFAULT_COINFLIP_CONFIG, MinigameError } from "@/features/economy/minigames";
import { defineCommand } from "@/framework";
import type { Ctx } from "@/framework/types";
import type { AccentKey } from "@/ui/theme";
import { container, text, v2Message } from "@/ui/v2";

export interface CoinflipErrorCopy {
  readonly title: string;
  readonly description: string;
  readonly accent: AccentKey;
}

const data = new SlashCommandBuilder()
  .setName("coinflip")
  .setDescription("Bet coins on a coinflip")
  .addIntegerOption((opt) =>
    opt
      .setName("amount")
      .setDescription("Amount to wager")
      .setRequired(true)
      .setMinValue(DEFAULT_COINFLIP_CONFIG.minBet),
  )
  .addStringOption((opt) =>
    opt
      .setName("side")
      .setDescription("Side to bet on (default: heads)")
      .setRequired(false)
      .addChoices({ name: "Heads", value: "heads" }, { name: "Tails", value: "tails" }),
  );

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

async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      content: "This command can only be used in a server.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const amount = interaction.options.getInteger("amount", true);
  const side = (interaction.options.getString("side") ?? "heads") as "heads" | "tails";

  if (amount < DEFAULT_COINFLIP_CONFIG.minBet) {
    const copy = coinflipErrorCopy(new MinigameError("BET_TOO_LOW", ""));
    await interaction.reply({
      ...v2Message(container(copy.accent, text(`## ${copy.title}\n${copy.description}`))),
      flags: MessageFlags.Ephemeral,
    } as any);
    return;
  }

  await interaction.deferReply();

  try {
    const { won, betAmount, winnings, outcome } = await coinflip(
      ctx,
      interaction.user.id,
      side,
      amount,
    );

    const payload = won
      ? v2Message(
          container("ok", text(`## You Won!\nYou won **${winnings} coins**! It was ${outcome}.`)),
        )
      : v2Message(
          container(
            "danger",
            text(`## You Lost!\nYou lost **${betAmount} coins**. It was ${outcome}.`),
          ),
        );

    await interaction.editReply(payload);
  } catch (err) {
    const copy = coinflipErrorCopy(err instanceof Error ? err : new Error(String(err)));
    await interaction.editReply(
      v2Message(container(copy.accent, text(`## ${copy.title}\n${copy.description}`))),
    );
  }
}

export default defineCommand({
  data,
  help: { hints: ["/balance", "/work"] },
  execute,
});
