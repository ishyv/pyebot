import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { getContentRegistry } from "@/content/registry";
import { DEFAULT_CONTENT_PACK } from "@/content/packs/default";
import { craftItems } from "@/features/rpg/crafting/crafting-engine";

// Build dynamic choices — Discord limit is 25
const contentItems = Object.values(DEFAULT_CONTENT_PACK.items);
const choices = contentItems
  .filter((item) => {
    const sources = item.sources as readonly string[];
    return sources.includes("gather") || sources.includes("craft");
  })
  .slice(0, 25)
  .map(item => ({ name: item.name, value: item.id }));

function getCraftItemDef(id: string) {
  return getContentRegistry()?.getItem(id) ?? null;
}

const DISCOVERY_QUOTES = [
  "You are the first soul to ever synthesize this compound.",
  "No record of this formula exists. You have written history.",
  "The Lodge scribes will hear of this.",
  "First discovery. The recipe has been etched into the collective memory.",
  "The Accord's analysts would pay handsomely to know what you just made.",
];

const METHOD_FLAVOUR: Record<string, string> = {
  transform: "You exert force, heat, or skill. The item changes its nature.",
  mixture: "You combine the materials carefully. A new form emerges.",
  alchemy: "The Crucible hums, traits merging in the white-hot heat of the synthesis.",
};

export const data = new SlashCommandBuilder()
  .setName("craft")
  .setDescription("Transform 1 item or mix 2-3 items into something new.")
  .addStringOption((opt) =>
    opt.setName("item1").setDescription("Primary ingredient").setRequired(true).addChoices(...choices)
  )
  .addStringOption((opt) =>
    opt.setName("item2").setDescription("Optional second ingredient").setRequired(false).addChoices(...choices)
  )
  .addStringOption((opt) =>
    opt.setName("item3").setDescription("Optional third ingredient").setRequired(false).addChoices(...choices)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const i1 = interaction.options.getString("item1", true);
  const i2 = interaction.options.getString("item2");
  const i3 = interaction.options.getString("item3");

  const inputs = [i1];
  if (i2) inputs.push(i2);
  if (i3) inputs.push(i3);

  const result = await craftItems(interaction.user.id, inputs);

  if (result.isErr()) {
    const error = result.error;
    const embed = new EmbedBuilder()
      .setColor(0x3a1a1a)
      .setTitle("⚒️ Crafting Unsuccessful")
      .setDescription(`**${error.message}**\n\nThe materials remain, but they do not yield to your efforts.`)
      .setFooter({ text: "Ashenmoor · The Workshop" });
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const { outputId, outputName, qty, method, isNewDiscovery } = result.unwrap();
  const outDef = getCraftItemDef(outputId);
  const isVolatile = outputId.includes("volatile") || outputName.toLowerCase().includes("ash");

  const ingredientLine = inputs
    .map(id => `**${getCraftItemDef(id)?.name ?? id}**`)
    .join(" · ");

  let discoveryBlock = "";
  if (isNewDiscovery && !isVolatile) {
    const quote = DISCOVERY_QUOTES[Math.floor(Math.random() * DISCOVERY_QUOTES.length)];
    discoveryBlock = `\n\n━━━━━━━━━━━━━━━━━━━━\n✦ **FIRST DISCOVERY** ✦\n*${quote}*`;
  }

  // Choose colour based on outcome
  let color: number;
  if (isVolatile) color = 0x2a2a2a;
  else if (isNewDiscovery) color = 0xc89b3c; // gold
  else if (method === "transform") color = 0x5c3b2e; // rustic brown
  else color = 0x5c3566; // muted purple

  const methodText = METHOD_FLAVOUR[method] ?? "Materials merge.";
  const rarityLine = outDef ? `— *${outDef.rarity}*` : "";

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(isVolatile ? "⚒️ Failed Synthesis" : "⚒️ Crafting Complete")
    .setDescription(
      isVolatile
        ? `${ingredientLine}\n\n*The traits fought and nothing won. Volatile Ash is what remains.*\n\n**Result: 1x Volatile Ash**`
        : `${ingredientLine}\n\n*${methodText}*\n\n**Result: ${qty}x ${outputName}** ${rarityLine}${discoveryBlock}`
    )
    .setFooter({ text: `Ashenmoor · ${interaction.user.username}` });

  await interaction.editReply({ embeds: [embed] });
}
