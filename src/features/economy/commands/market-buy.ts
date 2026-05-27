import type { ChatInputCommandInteraction } from "discord.js";
import { buyListing } from "@/features/economy/market";
import { command } from "@/framework";
import type { Ctx } from "@/framework/types";
import { container, text, v2Message } from "@/ui/v2";

const data = command("market-buy")
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
  await ctx.respond.defer({ visibility: "ephemeral" });

  if (!interaction.guild) {
    await ctx.respond.send({ content: "This command can only be used in a server." });
    return;
  }

  const listingId = interaction.options.getString("listing_id", true);
  const quantity = interaction.options.getInteger("quantity") ?? 1;
  const buyerId = interaction.user.id;

  const result = await buyListing(ctx, buyerId, listingId, quantity);

  if (result.isErr()) {
    await ctx.respond.send({ content: `Error: ${result.error.message}` });
    return;
  }

  const { itemId, quantity: qty, total } = result.unwrap();

  await ctx.respond.send(
    v2Message(
      container(
        "ok",
        text(`## Purchase Successful\nPurchased **${qty}x ${itemId}** for **${total} coins**`),
      ),
    ),
  );
}

export default data
  .help({ hints: ["/market-browse", "/balance"] })
  .run(({ interaction, ctx }) =>
    (execute as (...args: never[]) => Promise<void>)(interaction as never, ctx as never),
  );
