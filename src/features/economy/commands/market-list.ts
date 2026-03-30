import {
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import { createListing } from "@/features/economy/market";

export const data = new SlashCommandBuilder()
  .setName("market-list")
  .setDescription("List an item for sale on the market")
  .addStringOption((opt) =>
    opt.setName("item_id").setDescription("Item ID to list").setRequired(true),
  )
  .addIntegerOption((opt) =>
    opt.setName("quantity").setDescription("Quantity to sell").setRequired(true).setMinValue(1),
  )
  .addIntegerOption((opt) =>
    opt
      .setName("price")
      .setDescription("Price per unit in coins")
      .setRequired(true)
      .setMinValue(1),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const itemId = interaction.options.getString("item_id", true);
  const quantity = interaction.options.getInteger("quantity", true);
  const price = interaction.options.getInteger("price", true);
  const sellerId = interaction.user.id;
  const guildId = interaction.guild.id;

  const result = await createListing(sellerId, guildId, itemId, quantity, price);

  if (result.isErr()) {
    await interaction.editReply({ content: `Error: ${result.error.message}` });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(Colors.Green)
    .setTitle("Listing Created")
    .setDescription(`Listed **${quantity}x ${itemId}** for **${price} coins** each`);

  await interaction.editReply({ embeds: [embed] });
}
