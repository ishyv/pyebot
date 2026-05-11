import {
  type ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import { coinflip, DEFAULT_COINFLIP_CONFIG, MinigameError } from "@/features/economy/minigames";

export interface CoinflipErrorCopy {
  readonly title: string;
  readonly description: string;
  readonly color: number;
}

export const data = new SlashCommandBuilder()
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
        description: `Coinflip requires a wager of at least ${DEFAULT_COINFLIP_CONFIG.minBet} coins. Pick a bigger wager and try again.`,
        color: Colors.Yellow,
      };
    }
    if (error.code === "BET_TOO_HIGH") {
      return {
        title: "Table Limit",
        description: `The current table limit is **${DEFAULT_COINFLIP_CONFIG.maxBet} coins**.`,
        color: Colors.Yellow,
      };
    }
    if (error.code === "INSUFFICIENT_FUNDS") {
      return {
        title: "Not Enough Coins",
        description: error.message,
        color: Colors.Yellow,
      };
    }
    if (error.code === "COOLDOWN_ACTIVE") {
      return {
        title: "Coinflip Cooling Down",
        description: error.message,
        color: Colors.Yellow,
      };
    }
  }

  return {
    title: "Coinflip Unavailable",
    description: error.message,
    color: Colors.Red,
  };
}

function coinflipErrorEmbed(error: Error): EmbedBuilder {
  const copy = coinflipErrorCopy(error);
  return new EmbedBuilder()
    .setColor(copy.color)
    .setTitle(copy.title)
    .setDescription(copy.description);
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      content: "This command can only be used in a server.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const amount = interaction.options.getInteger("amount", true);
  const side = (interaction.options.getString("side") ?? "heads") as "heads" | "tails";
  const userId = interaction.user.id;

  if (amount < DEFAULT_COINFLIP_CONFIG.minBet) {
    await interaction.reply({
      embeds: [coinflipErrorEmbed(new MinigameError("BET_TOO_LOW", ""))],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply();

  const result = await coinflip(userId, side, amount);

  if (result.isErr()) {
    await interaction.editReply({ embeds: [coinflipErrorEmbed(result.error)] });
    return;
  }

  const { won, betAmount, winnings, outcome } = result.unwrap();

  const embed = won
    ? new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle("You Won!")
        .setDescription(`You won **${winnings} coins**! It was ${outcome}.`)
    : new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle("You Lost!")
        .setDescription(`You lost **${betAmount} coins**. It was ${outcome}.`);

  await interaction.editReply({ embeds: [embed] });
}
