import {
  SlashCommandBuilder,
  EmbedBuilder,
  Colors,
  type ChatInputCommandInteraction,
} from "discord.js";
import { cutdown } from "@/features/rpg/gathering";
import { getHints } from "@/utils/command-registry";

export const data = new SlashCommandBuilder()
  .setName("gather-cutdown")
  .setDescription("Cut down trees at a forest location")
  .addStringOption((opt) =>
    opt.setName("location").setDescription("The location ID to cut down trees at").setRequired(true),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  const location = interaction.options.getString("location", true);
  const userId = interaction.user.id;

  const result = await cutdown(userId, location);

  if (result.isErr()) {
    const err = result.error;
    let description: string;
    if (err.code === "NO_TOOL_EQUIPPED") {
      description =
        "You need an axe equipped. Start at Oak Forest with your starter axe: `/gather-cutdown oak_forest`.";
    } else if (err.code === "INSUFFICIENT_TOOL_TIER") {
      description =
        "🔒 You need a higher-tier axe to cut here. Craft one with `/craft <axe>` (see `/gather-locations` for what's unlocked).";
    } else if (err.code === "LOCATION_NOT_FOUND") {
      description = "Unknown location. Use `/gather-locations` to browse available spots.";
    } else {
      description = err.message;
    }
    const errorEmbed = new EmbedBuilder()
      .setColor(Colors.Red)
      .setDescription(description)
      .setFooter({ text: getHints("gather-cutdown") });
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  const { locationName, tier, materialsGained, remainingDurability, toolBroken } = result.unwrap();

  const materialsText =
    materialsGained.length > 0
      ? materialsGained.map((m) => `${m.quantity}x ${m.id}`).join(", ")
      : "Nothing";

  const durabilityText = toolBroken ? "Tool broke!" : `${remainingDurability}`;

  const embed = new EmbedBuilder()
    .setColor(Colors.Green)
    .setTitle(`You cut down trees at **${locationName}** (Tier ${tier})`)
    .addFields(
      { name: "Materials Gained", value: materialsText, inline: true },
      { name: "Tool Durability", value: durabilityText, inline: true },
    )
    .setFooter({ text: getHints("gather-cutdown") });

  await interaction.editReply({ embeds: [embed] });
}
