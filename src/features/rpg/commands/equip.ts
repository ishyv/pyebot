import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import { getUser } from "@/db/repositories/users";
import { getHints } from "@/utils/command-registry";
import { EQUIPABLE_TOOLS } from "@/features/rpg/handlers/equip";

export const data = new SlashCommandBuilder()
  .setName("equip")
  .setDescription("Equip a tool from your inventory");

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const userId = interaction.user.id;

  const userRes = await getUser(userId);
  if (userRes.isErr()) {
    await interaction.editReply({ content: "Something went wrong. Please try again." });
    return;
  }

  const user = userRes.unwrap();
  if (!user) {
    await interaction.editReply({ content: "User profile not found. Please try again." });
    return;
  }

  const inventory = user.inventory ?? {};

  // Filter inventory to items that are valid tools and present with qty >= 1
  const availableTools = Object.entries(inventory)
    .filter(([itemId, qty]) => EQUIPABLE_TOOLS.has(itemId) && typeof qty === "number" && qty >= 1)
    .map(([itemId, qty]) => ({ itemId, qty: qty as number }));

  const footer = { text: getHints("equip") };

  if (availableTools.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(Colors.Orange)
      .setDescription("You don't have any tools in your inventory. Craft one with `/craft`.")
      .setFooter(footer);
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const currentWeapon = user.rpgProfile?.loadout?.weapon;
  const currentItemId =
    currentWeapon && typeof currentWeapon === "object" && "itemId" in currentWeapon
      ? currentWeapon.itemId
      : typeof currentWeapon === "string"
        ? currentWeapon
        : null;

  const options = availableTools.map(({ itemId, qty }) => {
    const isEquipped = itemId === currentItemId;
    return new StringSelectMenuOptionBuilder()
      .setValue(itemId)
      .setLabel(itemId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
      .setDescription(isEquipped ? `×${qty} in inventory (currently equipped)` : `×${qty} in inventory`)
      .setDefault(isEquipped);
  });

  const select = new StringSelectMenuBuilder()
    .setCustomId("equip:select")
    .setPlaceholder("Choose a tool to equip…")
    .addOptions(options);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

  const embed = new EmbedBuilder()
    .setColor(Colors.Blue)
    .setTitle("🗡️ Equip a Tool")
    .setDescription(
      currentItemId
        ? `Currently equipped: \`${currentItemId}\`\n\nSelect a tool from the dropdown to equip it.`
        : "Select a tool from the dropdown to equip it.",
    )
    .setFooter(footer);

  await interaction.editReply({ embeds: [embed], components: [row] });
}
