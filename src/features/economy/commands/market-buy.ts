import { type ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { buyListing } from "@/features/economy/market";
import { defineCommand } from "@/framework";
import type { Ctx } from "@/framework/types";
import { container, text, v2Message } from "@/ui/v2";

const data = new SlashCommandBuilder()
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

async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
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

  await interaction.editReply(
    v2Message(
      container(
        "ok",
        text(`## Purchase Successful\nPurchased **${qty}x ${itemId}** for **${total} coins**`),
      ),
    ),
  );
}

export default defineCommand({
  data,
  help: { hints: ["/market-browse", "/balance"] },
  execute,
});
