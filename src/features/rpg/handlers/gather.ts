/**
 * Gather button handler.
 *
 * Custom ID format: `gather:<action>:<locationId>`
 * where <action> is "mine" or "forest".
 *
 * Called when a user selects a location from the picker shown by
 * /gather-mine or /gather-cutdown.
 */

import { EmbedBuilder, Colors, type ButtonInteraction } from "discord.js";
import { mine, cutdown } from "@/features/rpg/gathering";
import { getHints } from "@/utils/command-registry";

const PREFIX = "gather:";

export function isGatherButton(customId: string): boolean {
  return customId.startsWith(PREFIX);
}

/** Parse `gather:<action>:<locationId>` → `{ action, locationId }` */
function parseGatherButton(customId: string): { action: "mine" | "forest"; locationId: string } | null {
  const parts = customId.slice(PREFIX.length).split(":");
  if (parts.length !== 2) return null;
  const [action, locationId] = parts as [string, string];
  if (action !== "mine" && action !== "forest") return null;
  return { action, locationId };
}

export async function handleGatherButton(interaction: ButtonInteraction): Promise<void> {
  const parsed = parseGatherButton(interaction.customId);
  if (!parsed) return;

  await interaction.deferReply({ ephemeral: true });

  const userId = interaction.user.id;
  const { action, locationId } = parsed;

  const result = action === "mine"
    ? await mine(userId, locationId)
    : await cutdown(userId, locationId);

  if (result.isErr()) {
    const err = result.error;
    let description: string;

    if (action === "mine") {
      if (err.code === "NO_TOOL_EQUIPPED") {
        description = "You need a pickaxe equipped. Use `/equip starter_pickaxe` to get started.";
      } else if (err.code === "INSUFFICIENT_TOOL_TIER") {
        description = "🔒 You need a higher-tier pickaxe to mine here. Craft one with `/craft <pickaxe>`.";
      } else if (err.code === "LOCATION_NOT_FOUND") {
        description = "Unknown location. Use `/gather-mine` to see available spots.";
      } else {
        description = err.message;
      }
    } else {
      if (err.code === "NO_TOOL_EQUIPPED") {
        description = "You need an axe equipped. Use `/equip starter_axe` to get started.";
      } else if (err.code === "INSUFFICIENT_TOOL_TIER") {
        description = "🔒 You need a higher-tier axe to cut here. Craft one with `/craft <axe>`.";
      } else if (err.code === "LOCATION_NOT_FOUND") {
        description = "Unknown location. Use `/gather-cutdown` to see available spots.";
      } else {
        description = err.message;
      }
    }

    const errorEmbed = new EmbedBuilder()
      .setColor(Colors.Red)
      .setDescription(description)
      .setFooter({ text: getHints(action === "mine" ? "gather-mine" : "gather-cutdown") });

    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }

  const { locationName, tier, materialsGained, remainingDurability, toolBroken } = result.unwrap();

  const materialsText =
    materialsGained.length > 0
      ? materialsGained.map((m) => `${m.quantity}× ${m.id}`).join("\n")
      : "Nothing this time";

  const durabilityText = toolBroken ? "💥 Tool broke!" : `${remainingDurability} / 100`;

  const embed = new EmbedBuilder()
    .setColor(action === "mine" ? Colors.DarkGrey : Colors.DarkGreen)
    .setTitle(action === "mine" ? `⛏️ Mined at ${locationName}` : `🪓 Cut down trees at ${locationName}`)
    .setDescription(`Tier ${tier} location`)
    .addFields(
      { name: "Materials Gained", value: materialsText, inline: true },
      { name: "Tool Durability", value: durabilityText, inline: true },
    )
    .setFooter({ text: getHints(action === "mine" ? "gather-mine" : "gather-cutdown") });

  await interaction.editReply({ embeds: [embed] });
}
