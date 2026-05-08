import {
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import { rob } from "@/features/economy/minigames";

export const data = new SlashCommandBuilder()
  .setName("rob")
  .setDescription("Attempt to rob another user")
  .addUserOption((opt) =>
    opt.setName("user").setDescription("User to rob").setRequired(true),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const target = interaction.options.getUser("user", true);
  const robberId = interaction.user.id;
  const targetId = target.id;

  const result = await rob(robberId, targetId);

  if (result.isErr()) {
    await interaction.editReply({ content: `Error: ${result.error.message}` });
    return;
  }

  const { stolenAmount, fineAmount } = result.unwrap();

  const embed =
    stolenAmount > 0
      ? new EmbedBuilder()
          .setColor(Colors.Orange)
          .setTitle("Robbery Successful!")
          .setDescription(`You stole **${stolenAmount} coins** from <@${targetId}>!`)
      : new EmbedBuilder()
          .setColor(Colors.Red)
          .setTitle("Caught!")
          .setDescription(`You got caught! Lost **${fineAmount} coins** as penalty.`);

  await interaction.editReply({ embeds: [embed] });
}
