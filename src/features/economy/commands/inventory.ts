import {
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import { getUser } from "@/db/repositories/users";
import { getHints } from "@/utils/command-registry";

export const data = new SlashCommandBuilder()
  .setName("inventory")
  .setDescription("View your item inventory")
  .addUserOption((opt) =>
    opt.setName("user").setDescription("User to view (defaults to you)").setRequired(false),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const target = interaction.options.getUser("user") ?? interaction.user;
  const result = await getUser(target.id);

  if (result.isErr()) {
    await interaction.editReply({ content: "Something went wrong. Please try again." });
    return;
  }

  const user = result.unwrap();
  const inventory = user?.inventory ?? {};
  const footer = { text: getHints("inventory") };

  const items = Object.entries(inventory).filter(
    ([, qty]) => typeof qty === "number" && (qty as number) > 0,
  ) as [string, number][];

  const embed = new EmbedBuilder()
    .setColor(Colors.DarkGold)
    .setTitle(`${target.username}'s Inventory`)
    .setFooter(footer);

  if (items.length === 0) {
    embed.setDescription("Empty — start gathering with `/gather-mine` or `/gather-cutdown`.");
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Determine equipped weapon so we can mark it
  const weapon = user?.rpgProfile?.loadout?.weapon;
  const equippedItemId =
    weapon && typeof weapon === "object" && "itemId" in weapon
      ? weapon.itemId
      : typeof weapon === "string"
        ? weapon
        : null;

  // Group items into raw materials, processed materials, and tools
  const RAW = ["stone", "copper_ore", "iron_ore", "silver_ore", "oak_wood", "spruce_wood", "palm_wood", "pine_wood"];
  const PROCESSED = ["stone_block", "copper_ingot", "iron_ingot", "silver_ingot", "oak_plank", "spruce_plank", "palm_plank", "pine_plank"];

  const raw: string[] = [];
  const processed: string[] = [];
  const tools: string[] = [];
  const other: string[] = [];

  for (const [itemId, qty] of items) {
    const label = itemId.replace(/_/g, " ");
    const equipped = itemId === equippedItemId ? " ⚔️" : "";
    const line = `\`${label}\` ×${qty}${equipped}`;

    if (RAW.includes(itemId)) raw.push(line);
    else if (PROCESSED.includes(itemId)) processed.push(line);
    else if (itemId.includes("pickaxe") || itemId.includes("axe")) tools.push(line);
    else other.push(line);
  }

  if (tools.length)     embed.addFields({ name: "🔧 Tools", value: tools.join("\n"), inline: false });
  if (raw.length)       embed.addFields({ name: "⛏️ Raw Materials", value: raw.join("\n"), inline: false });
  if (processed.length) embed.addFields({ name: "🔩 Processed", value: processed.join("\n"), inline: false });
  if (other.length)     embed.addFields({ name: "📦 Other", value: other.join("\n"), inline: false });

  await interaction.editReply({ embeds: [embed] });
}
