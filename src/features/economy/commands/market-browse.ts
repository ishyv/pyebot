import { browseListings } from "@/features/economy/market";
import { command } from "@/framework";
import { container, text, v2Message } from "@/ui/v2";

export default command("market-browse")
  .description("Browse active market listings")
  .string("item_id", "Filter by item ID")
  .guildOnly()
  .defer("ephemeral")
  .help({ hints: ["/market-buy", "/market-list"] })
  .run(async ({ ctx, guildId, options }) => {
    const itemId = options.item_id ?? undefined;
    const result = await browseListings(ctx, guildId, { itemId, pageSize: 10 });

    if (result.isErr()) {
      return { content: `Error: ${result.error.message}` };
    }

    const { listings } = result.unwrap();

    let body: string;
    if (listings.length === 0) {
      body = "## Market Listings\nNo listings found.";
    } else {
      const lines = listings.map((listing) => {
        const shortId = listing._id.slice(-8);
        return `**#${shortId}** — ${listing.quantity}x **${listing.itemId}** @ ${listing.pricePerUnit}/ea — <@${listing.sellerId}>`;
      });
      body = `## Market Listings\n${lines.join("\n")}`;
    }

    return v2Message(container("info", text(body)));
  });
