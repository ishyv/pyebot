import { buyListing } from "@/features/economy/market";
import { command } from "@/framework";
import { container, text, v2Message } from "@/ui/v2";

export default command("market-buy")
  .description("Purchase a market listing")
  .string("listing_id", "Listing ID to purchase", { required: true })
  .integer("quantity", "Quantity to buy (default: 1)", { min: 1 })
  .guildOnly()
  .defer("ephemeral")
  .help({ hints: ["/market-browse", "/balance"] })
  .run(async ({ ctx, userId, options }) => {
    const quantity = options.quantity ?? 1;
    const result = await buyListing(ctx, userId, options.listing_id, quantity);

    if (result.isErr()) {
      return { content: `Error: ${result.error.message}` };
    }

    const { itemId, quantity: qty, total } = result.unwrap();

    return v2Message(
      container(
        "ok",
        text(`## Purchase Successful\nPurchased **${qty}x ${itemId}** for **${total} coins**`),
      ),
    );
  });
