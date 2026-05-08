import {
  MessageFlags,
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import { userStore } from "@/db/repositories/users";
import { ensureAccount } from "@/features/economy/account";

const PAGE_SIZE = 10;

export const data = new SlashCommandBuilder()
  .setName("inventory")
  .setDescription("View your item inventory")
  .addIntegerOption((o) =>
    o.setName("page").setDescription("Page number").setMinValue(1),
  )
  .addUserOption((o) =>
    o.setName("user").setDescription("User to view (defaults to you)"),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const target = interaction.options.getUser("user") ?? interaction.user;
  const isSelf = target.id === interaction.user.id;
  const page = interaction.options.getInteger("page") ?? 1;

  if (isSelf) {
    await ensureAccount(target.id);
  }

  const userRes = await userStore.get(target.id);
  if (userRes.isErr()) {
    await interaction.editReply({ content: `Error: ${userRes.error.message}` });
    return;
  }

  const user = userRes.unwrap();
  const rawInventory = user?.inventory ?? {};

  // Normalize inventory: only show items with qty > 0
  const entries = Object.entries(rawInventory)
    .map(([id, qty]) => [id, Number(qty)] as [string, number])
    .filter(([, qty]) => qty > 0)
    .sort(([a], [b]) => a.localeCompare(b));

  if (entries.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(Colors.Grey)
      .setTitle(`🎒 Inventory — ${target.username}`)
      .setDescription(
        "Your inventory is empty.\nUse `/gather-mine` or `/gather-cutdown` to collect materials.",
      )
      .setFooter({ text: "💡 /gather-mine • /process • /market-list" });
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const totalPages = Math.ceil(entries.length / PAGE_SIZE);
  const clampedPage = Math.min(Math.max(page, 1), totalPages);
  const pageEntries = entries.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  const embed = new EmbedBuilder()
    .setColor(Colors.Blue)
    .setTitle(`🎒 Inventory — ${target.username}`)
    .setFooter({ text: `Page ${clampedPage}/${totalPages} • 💡 /gather-mine • /process • /market-list` });

  for (const [itemId, qty] of pageEntries) {
    embed.addFields({ name: itemId, value: `x${qty.toLocaleString()}`, inline: true });
  }

  await interaction.editReply({ embeds: [embed] });
}
