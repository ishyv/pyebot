import {
  MessageFlags,
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import { browseListings } from "@/features/economy/market";

export const data = new SlashCommandBuilder()
  .setName("market-browse")
  .setDescription("Browse active market listings")
  .addStringOption((opt) =>
    opt.setName("item_id").setDescription("Filter by item ID").setRequired(false),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const guildId = interaction.guild.id;
  const itemId = interaction.options.getString("item_id") ?? undefined;

  const result = await browseListings(guildId, { itemId, pageSize: 10 });

  if (result.isErr()) {
    await interaction.editReply({ content: `Error: ${result.error.message}` });
    return;
  }

  const { listings } = result.unwrap();

  const embed = new EmbedBuilder().setColor(Colors.Blue).setTitle("Market Listings");

  if (listings.length === 0) {
    embed.setDescription("No listings found.");
  } else {
    for (const listing of listings) {
      const shortId = listing._id.slice(-8);
      embed.addFields({
        name: `#${shortId}`,
        value: `${listing.quantity}x **${listing.itemId}** @ ${listing.pricePerUnit}/ea — <@${listing.sellerId}>`,
        inline: false,
      });
    }
  }

  await interaction.editReply({ embeds: [embed] });
}
