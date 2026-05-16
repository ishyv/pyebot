/**
 * Expedition interaction handler.
 *
 * CustomId scheme:
 *   expedition:start:<biome>    — choose biome and begin at depth 1
 *   expedition:gather:<nodeId>  — gather the visible node at that index
 *   expedition:deeper           — advance to the next depth
 *   expedition:leave            — end the session
 *
 * All interactions update the original ephemeral reply in-place via
 * deferUpdate + editReply so the player sees one persistent "screen"
 * rather than a thread of messages.
 */

import { ActionRowBuilder, ButtonBuilder, type ButtonInteraction, ButtonStyle } from "discord.js";
import {
  advance,
  type ExpeditionState,
  endSession,
  getSession,
  regenNodes,
  startSession,
} from "@/features/rpg/expedition/session";
import {
  actionForBiome,
  type Biome,
  locationForBiomeDepth,
  locationNameForBiomeDepth,
  MAX_DEPTH,
} from "@/features/rpg/expedition/world";
import { gatherAtLocation, getEquippedToolTier } from "@/features/rpg/gathering";
import { container, separator, text, v2Message } from "@/ui/v2";

const PREFIX = "expedition:";

export function isExpeditionButton(customId: string): boolean {
  return customId.startsWith(PREFIX);
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

const BIOME_EMOJI: Record<Biome, string> = { mine: "⛏️", forest: "🌲" };

/**
 * Builds the expedition v2 message and button rows for the current session state.
 * Row 1: one button per visible node.
 * Row 2: Go Deeper (gated by tool tier) + Leave.
 */
function renderExpedition(state: ExpeditionState, toolTier: number, gatherLine?: string) {
  const locationName = locationNameForBiomeDepth(state.biome, state.depth);
  const emoji = BIOME_EMOJI[state.biome];

  const nodeList = state.nodes.map((n) => `**${n.display}** — *${n.flavor}*`).join("\n");

  const bodyText = gatherLine ? `${gatherLine}\n\n${nodeList}` : nodeList;

  const v2 = v2Message(
    container(
      "info",
      text(`## ${emoji} ${locationName} — Depth ${state.depth}`),
      separator("sm"),
      text(bodyText),
      separator("sm"),
      text(`-# Tool tier: ${toolTier} | Depth ${state.depth}/${MAX_DEPTH} | 💡 /craft • /equip`),
    ),
  );

  const nodeButtons = state.nodes.map((node) =>
    new ButtonBuilder()
      .setCustomId(`expedition:gather:${node.id}`)
      .setLabel(`Gather ${node.display}`)
      .setStyle(ButtonStyle.Secondary),
  );
  const nodeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(nodeButtons);

  // Go Deeper requires tool tier >= next depth (= next tier)
  const canGoDeeper = state.depth < MAX_DEPTH && toolTier >= state.depth + 1;
  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("expedition:deeper")
      .setLabel("Go Deeper →")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!canGoDeeper),
    new ButtonBuilder()
      .setCustomId("expedition:leave")
      .setLabel("Leave")
      .setStyle(ButtonStyle.Danger),
  );

  return { ...v2, _rows: [nodeRow, navRow] };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleExpeditionButton(interaction: ButtonInteraction): Promise<void> {
  const cid = interaction.customId;

  // ── Start ────────────────────────────────────────────────────────────────
  if (cid.startsWith("expedition:start:")) {
    const biomeRaw = cid.slice("expedition:start:".length);
    if (biomeRaw !== "mine" && biomeRaw !== "forest") return;
    const biome = biomeRaw as Biome;

    await interaction.deferUpdate();
    const userId = interaction.user.id;
    const state = startSession(userId, biome);
    const toolTier = await getEquippedToolTier(userId);
    const { _rows, ...v2Payload } = renderExpedition(state, toolTier);
    await interaction.editReply({ ...v2Payload, components: [...v2Payload.components, ..._rows] });
    return;
  }

  // ── Gather ───────────────────────────────────────────────────────────────
  if (cid.startsWith("expedition:gather:")) {
    const nodeId = cid.slice("expedition:gather:".length);
    await interaction.deferUpdate();

    const userId = interaction.user.id;
    const state = getSession(userId);
    if (!state) {
      await interaction.followUp({
        content: "Your expedition has expired. Use `/expedition` to start a new one.",
        ephemeral: true,
      });
      return;
    }

    const node = state.nodes.find((n) => n.id === nodeId);
    if (!node) {
      await interaction.followUp({
        content: "That resource has shifted. The area looks different now.",
        ephemeral: true,
      });
      return;
    }

    const locationId = locationForBiomeDepth(state.biome, state.depth);
    const action = actionForBiome(state.biome);
    // v2 signature: gatherAtLocation(userId, action, locationId)
    const result = await gatherAtLocation(userId, action, locationId);

    if (result.isErr()) {
      const err = result.error;
      let msg: string;
      if (err.code === "NO_TOOL_EQUIPPED") {
        msg =
          state.biome === "mine"
            ? "You need a pickaxe equipped. Use `/equip` to select one."
            : "You need an axe equipped. Use `/equip` to select one.";
      } else if (err.code === "INSUFFICIENT_TOOL_TIER") {
        msg = `🔒 Your tool isn't strong enough here (needs tier ${state.depth}). Craft a better one with \`/craft\`.`;
      } else {
        msg = err.message;
      }
      await interaction.followUp({ content: msg, ephemeral: true });
      return;
    }

    const { materialsGained, toolBroken, remainingDurability } = result.unwrap();
    const materialsText = materialsGained.map((m) => `+${m.quantity}× ${m.id}`).join(", ");
    const durabilityNote = toolBroken
      ? " 💥 *(tool broke!)*"
      : ` *(durability: ${remainingDurability})*`;
    const gatherLine = `✅ **${node.display}** → ${materialsText}${durabilityNote}`;

    const newState = regenNodes(userId) ?? state;
    const toolTier = await getEquippedToolTier(userId);
    const { _rows, ...v2Payload } = renderExpedition(newState, toolTier, gatherLine);
    await interaction.editReply({ ...v2Payload, components: [...v2Payload.components, ..._rows] });
    return;
  }

  // ── Go Deeper ─────────────────────────────────────────────────────────────
  if (cid === "expedition:deeper") {
    await interaction.deferUpdate();
    const userId = interaction.user.id;
    const newState = advance(userId);
    if (!newState) {
      await interaction.followUp({
        content: "You've reached the deepest point, or your session has expired.",
        ephemeral: true,
      });
      return;
    }
    const toolTier = await getEquippedToolTier(userId);
    const { _rows, ...v2Payload } = renderExpedition(newState, toolTier);
    await interaction.editReply({ ...v2Payload, components: [...v2Payload.components, ..._rows] });
    return;
  }

  // ── Leave ─────────────────────────────────────────────────────────────────
  if (cid === "expedition:leave") {
    await interaction.deferUpdate();
    endSession(interaction.user.id);
    await interaction.editReply({
      ...v2Message(
        container(
          "mute",
          text(
            "## 🚪 Expedition Ended\nYou leave the area and return to safety.\n\nUse `/expedition` to venture out again.\n\n-# 💡 /inventory • /process • /craft",
          ),
        ),
      ),
      components: [],
    });
  }
}
