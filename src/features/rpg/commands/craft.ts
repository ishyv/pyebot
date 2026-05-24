import {
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { CRAFTING_RECIPES } from "@/features/rpg/content/recipes";
import { craft } from "@/features/rpg/crafting";
import { defineCommand } from "@/framework";
import type { Ctx } from "@/framework/types";
import { container, separator, text, v2Message } from "@/ui/v2";
import { getHints } from "@/utils/command-registry";

const data = new SlashCommandBuilder()
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

async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused().toLowerCase();
  const choices = Object.keys(CRAFTING_RECIPES)
    .filter((key) => key.toLowerCase().includes(focused))
    .map((key) => ({ name: key, value: key }))
    .slice(0, 25);
  await interaction.respond(choices);
}

async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const itemId = interaction.options.getString("item", true);
  const quantity = interaction.options.getInteger("quantity") ?? 1;
  const userId = interaction.user.id;

  const result = await craft(ctx, userId, itemId, quantity);

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

    await interaction.editReply(
      v2Message(container("danger", text(`${description}\n-# ${getHints("craft")}`))),
    );
    return;
  }

  const { materialsConsumed } = result.unwrap();

  const materialsText = Object.entries(materialsConsumed)
    .map(([material, amount]) => `${amount}x ${material}`)
    .join("\n");

  await interaction.editReply(
    v2Message(
      container(
        "ok",
        text(`## Crafted!\nYou crafted ${quantity}x \`${itemId}\``),
        separator("sm"),
        text(`**Materials Used**\n${materialsText || "None"}\n-# ${getHints("craft")}`),
      ),
    ),
  );
}

export default defineCommand({
  data,
  help: { hints: ["/equip", "/inventory", "/expedition"] },
  autocomplete,
  execute,
});
