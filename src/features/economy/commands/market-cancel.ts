import { type ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { cancelListing } from "@/features/economy/market";
import { defineCommand } from "@/framework";
import type { Ctx } from "@/framework/types";
import { container, text, v2Message } from "@/ui/v2";

const data = new SlashCommandBuilder()
  .setName("market-cancel")
  .setDescription("Cancel one of your market listings")
  .addStringOption((opt) =>
    opt.setName("listing_id").setDescription("Listing ID to cancel").setRequired(true),
  );

async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  await ctx.respond.defer({ visibility: "ephemeral" });

  if (!interaction.guild) {
    await ctx.respond.send({ content: "This command can only be used in a server." });
    return;
  }

  const listingId = interaction.options.getString("listing_id", true);
  const sellerId = interaction.user.id;

  const result = await cancelListing(ctx, sellerId, listingId);

  if (result.isErr()) {
    await ctx.respond.send({ content: `Error: ${result.error.message}` });
    return;
  }

  const { itemId, returnedQuantity } = result.unwrap();

  await ctx.respond.send(
    v2Message(
      container(
        "ok",
        text(
          `## Listing Cancelled\nListing cancelled. **${returnedQuantity}x ${itemId}** returned to your inventory.`,
        ),
      ),
    ),
  );
}

export default defineCommand({
  data,
  help: { hints: ["/market-browse", "/market-list"] },
  execute,
});
