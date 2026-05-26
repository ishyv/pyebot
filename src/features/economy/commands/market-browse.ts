import { type ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { browseListings } from "@/features/economy/market";
import { defineCommand } from "@/framework";
import type { Ctx } from "@/framework/types";
import { container, text, v2Message } from "@/ui/v2";

const data = new SlashCommandBuilder()
  .setName("market-browse")
  .setDescription("Browse active market listings")
  .addStringOption((opt) =>
    opt.setName("item_id").setDescription("Filter by item ID").setRequired(false),
  );

async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  await ctx.respond.defer({ visibility: "ephemeral" });

  if (!interaction.guild) {
    await ctx.respond.send({ content: "This command can only be used in a server." });
    return;
  }

  const guildId = interaction.guild.id;
  const itemId = interaction.options.getString("item_id") ?? undefined;

  const result = await browseListings(ctx, guildId, { itemId, pageSize: 10 });

  if (result.isErr()) {
    await ctx.respond.send({ content: `Error: ${result.error.message}` });
    return;
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

  await ctx.respond.send(v2Message(container("info", text(body))));
}

export default defineCommand({
  data,
  help: { hints: ["/market-buy", "/market-list"] },
  execute,
});
