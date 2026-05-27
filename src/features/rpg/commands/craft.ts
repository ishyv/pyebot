import type { AutocompleteInteraction } from "discord.js";
import { CRAFTING_RECIPES } from "@/features/rpg/content/recipes";
import { craft } from "@/features/rpg/crafting";
import { command } from "@/framework";
import { container, separator, text, v2Message } from "@/ui/v2";
import { getHints } from "@/utils/command-registry";

async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused().toLowerCase();
  const choices = Object.keys(CRAFTING_RECIPES)
    .filter((key) => key.toLowerCase().includes(focused))
    .map((key) => ({ name: key, value: key }))
    .slice(0, 25);
  await interaction.respond(choices);
}

export default command("craft")
  .description("Craft an item using materials from your inventory")
  .string("item", "The item ID to craft (e.g. stone_pickaxe)", {
    required: true,
    autocomplete: true,
  })
  .integer("quantity", "How many to craft (default: 1)", { min: 1, max: 99 })
  .guildOnly()
  .defer("ephemeral")
  .help({ hints: ["/equip", "/inventory", "/expedition"] })
  .autocomplete(autocomplete)
  .run(async ({ ctx, userId, options }) => {
    const itemId = options.item;
    const quantity = options.quantity ?? 1;

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

      return v2Message(container("danger", text(`${description}\n-# ${getHints("craft")}`)));
    }

    const { materialsConsumed } = result.unwrap();

    const materialsText = Object.entries(materialsConsumed)
      .map(([material, amount]) => `${amount}x ${material}`)
      .join("\n");

    return v2Message(
      container(
        "ok",
        text(`## Crafted!\nYou crafted ${quantity}x \`${itemId}\``),
        separator("sm"),
        text(`**Materials Used**\n${materialsText || "None"}\n-# ${getHints("craft")}`),
      ),
    );
  });
