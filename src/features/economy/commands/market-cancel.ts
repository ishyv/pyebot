import {
  MessageFlags,
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Ctx } from "@/framework/types";
import { cancelListing } from "@/features/economy/market";

export const data = new SlashCommandBuilder()
  .setName("market-cancel")
  .setDescription("Cancel one of your market listings")
  .addStringOption((opt) =>
    opt.setName("listing_id").setDescription("Listing ID to cancel").setRequired(true),
  );

export async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const listingId = interaction.options.getString("listing_id", true);
  const sellerId = interaction.user.id;

  const result = await cancelListing(ctx, sellerId, listingId);

  if (result.isErr()) {
    await interaction.editReply({ content: `Error: ${result.error.message}` });
    return;
  }

  const { itemId, returnedQuantity } = result.unwrap();

  const embed = new EmbedBuilder()
    .setColor(Colors.Green)
    .setTitle("Listing Cancelled")
    .setDescription(`Listing cancelled. **${returnedQuantity}x ${itemId}** returned to your inventory.`);

  await interaction.editReply({ embeds: [embed] });
}
