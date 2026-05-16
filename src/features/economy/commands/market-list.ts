import { type ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { createListing } from "@/features/economy/market";
import { defineCommand } from "@/framework";
import type { Ctx } from "@/framework/types";
import { container, text, v2Message } from "@/ui/v2";

const data = new SlashCommandBuilder()
  .setName("market-list")
  .setDescription("List an item for sale on the market")
  .addStringOption((opt) =>
    opt.setName("item_id").setDescription("Item ID to list").setRequired(true),
  )
  .addIntegerOption((opt) =>
    opt.setName("quantity").setDescription("Quantity to sell").setRequired(true).setMinValue(1),
  )
  .addIntegerOption((opt) =>
    opt.setName("price").setDescription("Price per unit in coins").setRequired(true).setMinValue(1),
  );

async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const itemId = interaction.options.getString("item_id", true);
  const quantity = interaction.options.getInteger("quantity", true);
  const price = interaction.options.getInteger("price", true);
  const sellerId = interaction.user.id;
  const guildId = interaction.guild.id;

  const result = await createListing(ctx, sellerId, guildId, itemId, quantity, price);

  if (result.isErr()) {
    await interaction.editReply({ content: `Error: ${result.error.message}` });
    return;
  }

  await interaction.editReply(
    v2Message(
      container(
        "ok",
        text(`## Listing Created\nListed **${quantity}x ${itemId}** for **${price} coins** each`),
      ),
    ),
  );
}

export default defineCommand({
  data,
  help: { hints: ["/market-browse", "/balance"] },
  execute,
});
