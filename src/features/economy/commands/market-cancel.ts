import { cancelListing } from "@/features/economy/market";
import { command } from "@/framework";
import { container, text, v2Message } from "@/ui/v2";

export default command("market-cancel")
  .description("Cancel one of your market listings")
  .string("listing_id", "Listing ID to cancel", { required: true })
  .guildOnly()
  .defer("ephemeral")
  .help({ hints: ["/market-browse", "/market-list"] })
  .run(async ({ ctx, userId, options }) => {
    const result = await cancelListing(ctx, userId, options.listing_id);

    if (result.isErr()) {
      return { content: `Error: ${result.error.message}` };
    }

    const { itemId, returnedQuantity } = result.unwrap();

    return v2Message(
      container(
        "ok",
        text(
          `## Listing Cancelled\nListing cancelled. **${returnedQuantity}x ${itemId}** returned to your inventory.`,
        ),
      ),
    );
  });
