import {
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import { getBalance } from "@/features/economy/mutations";

export const data = new SlashCommandBuilder()
  .setName("balance")
  .setDescription("Check a user's coin balance")
  .addUserOption((opt) =>
    opt.setName("user").setDescription("User to check (defaults to you)").setRequired(false),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const target = interaction.options.getUser("user") ?? interaction.user;
  const result = await getBalance(target.id, "coins");

  if (result.isErr()) {
    await interaction.editReply({ content: `Error: ${result.error.message}` });
    return;
  }

  const balance = result.unwrap();

  const embed = new EmbedBuilder()
    .setColor(Colors.Green)
    .setTitle(`${target.username}'s Balance`)
    .setDescription(`**${balance} coins**`);

  await interaction.editReply({ embeds: [embed] });
}
