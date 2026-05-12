import {
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
  type AutocompleteInteraction,
} from "discord.js";
import { craft } from "@/features/rpg/crafting";
import { CRAFTING_RECIPES } from "@/features/rpg/content/recipes";
import { getHints } from "@/utils/command-registry";

export const data = new SlashCommandBuilder()
  .setName("craft")
  .setDescription("Craft an item using materials from your inventory")
  .addStringOption((opt) =>
    opt
      .setName("item")
      .setDescription("The item ID to craft (e.g. stone_pickaxe)")
      .setRequired(true)
      .setAutocomplete(true),
  )
  .addIntegerOption((opt) =>
    opt
      .setName("quantity")
      .setDescription("How many to craft (default: 1)")
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(99),
  );

export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused().toLowerCase();
  const choices = Object.keys(CRAFTING_RECIPES)
    .filter((key) => key.toLowerCase().includes(focused))
    .map((key) => ({ name: key, value: key }))
    .slice(0, 25);
  await interaction.respond(choices);
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const itemId = interaction.options.getString("item", true);
  const quantity = interaction.options.getInteger("quantity") ?? 1;
  const userId = interaction.user.id;

  const result = await craft(userId, itemId, quantity);

  if (result.isErr()) {
    const err = result.error;
    let description: string;

    if (err.code === "RECIPE_NOT_FOUND") {
      description = `No recipe for \`${itemId}\`. Use \`/help craft\` to see craftable items.`;
    } else if (err.code === "INSUFFICIENT_MATERIALS") {
      description = err.message;
    } else if (err.code === "UPDATE_FAILED") {
      description = "Something went wrong saving your inventory. Please try again.";
    } else {
      description = err.message;
    }

    const errorEmbed = new EmbedBuilder()
      .setColor(Colors.Red)
      .setDescription(description)
      .setFooter({ text: getHints("craft") });
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  const { materialsConsumed } = result.unwrap();

  const materialsText = Object.entries(materialsConsumed)
    .map(([material, amount]) => `${amount}x ${material}`)
    .join("\n");

  const embed = new EmbedBuilder()
    .setColor(Colors.Gold)
    .setTitle("Crafted!")
    .setDescription(`You crafted ${quantity}x \`${itemId}\``)
    .addFields({ name: "Materials Used", value: materialsText || "None" })
    .setFooter({ text: getHints("craft") });

  await interaction.editReply({ embeds: [embed] });
}
