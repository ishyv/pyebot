import { createListing } from "@/features/economy/market";
import { command } from "@/framework";
import { container, text, v2Message } from "@/ui/v2";

export default command("market-list")
  .description("List an item for sale on the market")
  .string("item_id", "Item ID to list", { required: true })
  .integer("quantity", "Quantity to sell", { required: true, min: 1 })
  .integer("price", "Price per unit in coins", { required: true, min: 1 })
  .guildOnly()
  .defer("ephemeral")
  .help({ hints: ["/market-browse", "/balance"] })
  .run(async ({ ctx, userId, guildId, options }) => {
    const result = await createListing(
      ctx,
      userId,
      guildId,
      options.item_id,
      options.quantity,
      options.price,
    );

    if (result.isErr()) {
      return { content: `Error: ${result.error.message}` };
    }

    return v2Message(
      container(
        "ok",
        text(
          `## Listing Created\nListed **${options.quantity}x ${options.item_id}** for **${options.price} coins** each`,
        ),
      ),
    );
  });
