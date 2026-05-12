/**
 * Gather button handler.
 *
 * Routes clicks on the location buttons shown by /gather-mine and /gather-cutdown.
 * Custom-ID format: `gather:<action>:<locationId>`.
 *
 * Parsing is the runtime boundary: the raw Discord string is narrowed once
 * here into typed `GatherAction` + `LocationId`. Domain code (`gatherAtLocation`)
 * receives only trusted values.
 */

import { EmbedBuilder, Colors, type ButtonInteraction } from "discord.js";
import { gatherAtLocation } from "@/features/rpg/gathering";
import { getHints } from "@/utils/command-registry";
import {
  parseGatherAction,
  type GatherAction,
} from "@/features/rpg/content/actions";
import {
  parseLocationForAction,
  type LocationId,
} from "@/features/rpg/content/locations";

const PREFIX = "gather:";

export function isGatherButton(customId: string): boolean {
  return customId.startsWith(PREFIX);
}

/** Narrow `gather:<action>:<locationId>` → typed action + location, or null if either is unknown. */
function parseGatherCustomId(
  customId: string,
): { action: GatherAction; locationId: LocationId } | null {
  const parts = customId.slice(PREFIX.length).split(":");
  if (parts.length !== 2) return null;
  const action = parseGatherAction(parts[0]);
  if (!action) return null;
  const locationId = parseLocationForAction(parts[1], action);
  if (!locationId) return null;
  return { action, locationId };
}

export async function handleGatherButton(interaction: ButtonInteraction): Promise<void> {
  const parsed = parseGatherCustomId(interaction.customId);
  if (!parsed) return;

  await interaction.deferReply({ ephemeral: true });

  const userId = interaction.user.id;
  const { action, locationId } = parsed;

  const result = await gatherAtLocation(userId, action, locationId);

  if (result.isErr()) {
    const err = result.error;
    const isMine = action === "mine";
    let description: string;

    if (err.code === "NO_TOOL_EQUIPPED") {
      description = isMine
        ? "You need a pickaxe equipped. Use `/equip starter_pickaxe` to get started."
        : "You need an axe equipped. Use `/equip starter_axe` to get started.";
    } else if (err.code === "INSUFFICIENT_TOOL_TIER") {
      description = isMine
        ? "🔒 You need a higher-tier pickaxe to mine here. Craft one with `/craft <pickaxe>`."
        : "🔒 You need a higher-tier axe to cut here. Craft one with `/craft <axe>`.";
    } else if (err.code === "LOCATION_NOT_FOUND") {
      description = isMine
        ? "Unknown location. Use `/gather-mine` to see available spots."
        : "Unknown location. Use `/gather-cutdown` to see available spots.";
    } else {
      description = err.message;
    }

    const errorEmbed = new EmbedBuilder()
      .setColor(Colors.Red)
      .setDescription(description)
      .setFooter({ text: getHints(isMine ? "gather-mine" : "gather-cutdown") });

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
