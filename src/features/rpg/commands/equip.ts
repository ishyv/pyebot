import {
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import { getUser } from "@/db/repositories/users";
import { patchRpgProfile } from "@/db/repositories/rpg";
import { getHints } from "@/utils/command-registry";
import { RECIPES } from "@/features/rpg/crafting";

export const data = new SlashCommandBuilder()
  .setName("equip")
  .setDescription("Equip a tool from your inventory")
  .addStringOption((opt) =>
    opt
      .setName("item")
      .setDescription("The item ID to equip (e.g. stone_pickaxe)")
      .setRequired(true),
  );

/** Valid equipable tools: all craftable items plus the two starter tools. */
const EQUIPABLE_TOOLS = new Set([
  ...Object.keys(RECIPES),
  "starter_pickaxe",
  "starter_axe",
]);

function isValidTool(itemId: string): boolean {
  return EQUIPABLE_TOOLS.has(itemId);
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const itemId = interaction.options.getString("item", true);
  const userId = interaction.user.id;
  const footer = { text: getHints("equip") };

  // 1. Fetch user
  const userRes = await getUser(userId);
  if (userRes.isErr()) {
    const errorEmbed = new EmbedBuilder()
      .setColor(Colors.Red)
      .setDescription("Something went wrong fetching your profile. Please try again.")
      .setFooter(footer);
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  const user = userRes.unwrap();
  if (!user) {
    const errorEmbed = new EmbedBuilder()
      .setColor(Colors.Red)
      .setDescription("User profile not found. Please try again.")
      .setFooter(footer);
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  // 2. Check inventory ownership
  const inventory = user.inventory ?? {};
  const qty = (inventory[itemId] as number | undefined) ?? 0;
  if (qty < 1) {
    const errorEmbed = new EmbedBuilder()
      .setColor(Colors.Red)
      .setDescription(`You don't have \`${itemId}\` in your inventory.`)
      .setFooter(footer);
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  // 3. Validate that it's a known tool
  if (!isValidTool(itemId)) {
    const errorEmbed = new EmbedBuilder()
      .setColor(Colors.Red)
      .setDescription(`\`${itemId}\` is not a valid tool. Only pickaxes and axes can be equipped.`)
      .setFooter(footer);
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  // 4. Set loadout.weapon
  const currentLoadout = user.rpgProfile?.loadout ?? {
    weapon: null,
    shield: null,
    helmet: null,
    chest: null,
    pants: null,
    boots: null,
    ring: null,
    necklace: null,
  };

  const newLoadout = {
    ...currentLoadout,
    weapon: {
      instanceId: crypto.randomUUID(),
      itemId,
      durability: 100,
    },
  };

  const patchRes = await patchRpgProfile(userId, { loadout: newLoadout });
  if (patchRes.isErr()) {
    const errorEmbed = new EmbedBuilder()
      .setColor(Colors.Red)
      .setDescription("Something went wrong equipping your item. Please try again.")
      .setFooter(footer);
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  // 5. Success
  const embed = new EmbedBuilder()
    .setColor(Colors.Blue)
    .setDescription(`Equipped \`${itemId}\`!`)
    .setFooter(footer);

  await interaction.editReply({ embeds: [embed] });
}
