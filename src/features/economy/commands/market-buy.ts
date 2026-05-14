import {
  MessageFlags,
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Ctx } from "@/framework/types";
import { buyListing } from "@/features/economy/market";

export const data = new SlashCommandBuilder()
  .setName("market-buy")
  .setDescription("Purchase a market listing")
  .addStringOption((opt) =>
    opt.setName("listing_id").setDescription("Listing ID to purchase").setRequired(true),
  )
  .addIntegerOption((opt) =>
    opt
      .setName("quantity")
      .setDescription("Quantity to buy (default: 1)")
      .setRequired(false)
      .setMinValue(1),
  );

export async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const listingId = interaction.options.getString("listing_id", true);
  const quantity = interaction.options.getInteger("quantity") ?? 1;
  const buyerId = interaction.user.id;

  const result = await buyListing(ctx, buyerId, listingId, quantity);

  if (result.isErr()) {
    await interaction.editReply({ content: `Error: ${result.error.message}` });
    return;
  }

  const { itemId, quantity: qty, total } = result.unwrap();

  const embed = new EmbedBuilder()
    .setColor(Colors.Blue)
    .setTitle("Purchase Successful")
    .setDescription(`Purchased **${qty}x ${itemId}** for **${total} coins**`);

  await interaction.editReply({ embeds: [embed] });
}
