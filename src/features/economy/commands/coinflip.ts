import {
  MessageFlags,
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import { coinflip } from "@/features/economy/minigames";

export const data = new SlashCommandBuilder()
  .setName("coinflip")
  .setDescription("Bet coins on a coinflip")
  .addIntegerOption((opt) =>
    opt.setName("amount").setDescription("Amount to wager").setRequired(true).setMinValue(1),
  )
  .addStringOption((opt) =>
    opt
      .setName("side")
      .setDescription("Side to bet on (default: heads)")
      .setRequired(false)
      .addChoices({ name: "Heads", value: "heads" }, { name: "Tails", value: "tails" }),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const amount = interaction.options.getInteger("amount", true);
  const side = (interaction.options.getString("side") ?? "heads") as "heads" | "tails";
  const userId = interaction.user.id;

  const result = await coinflip(userId, side, amount);

  if (result.isErr()) {
    await interaction.editReply({ content: `Error: ${result.error.message}` });
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
