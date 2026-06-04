/**
 * Expedition interaction handlers — one per route (see ../routes.ts):
 *   expedition:start:<biome>    — choose biome and begin at depth 1
 *   expedition:gather:<nodeId>  — gather the visible node at that index
 *   expedition:deeper:          — advance to the next depth
 *   expedition:leave:           — end the session
 *
 * All interactions update the original ephemeral reply in-place via
 * deferUpdate + editReply so the player sees one persistent "screen"
 * rather than a thread of messages.
 */

import {
  ActionRowBuilder,
  type ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  MessageFlags,
} from "discord.js";
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
import { expeditionRoutes } from "@/features/rpg/routes";
import type { Ctx } from "@/framework/types";
import { container, separator, text, v2Message } from "@/ui/v2";

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
    expeditionRoutes.gather.button(
      { node: node.id },
      { label: `Gather ${node.display}`, style: ButtonStyle.Secondary },
    ),
  );
  const nodeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(nodeButtons);

  // Go Deeper requires tool tier >= next depth (= next tier)
  const canGoDeeper = state.depth < MAX_DEPTH && toolTier >= state.depth + 1;
  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    expeditionRoutes.deeper.button(
      {},
      { label: "Go Deeper →", style: ButtonStyle.Primary, disabled: !canGoDeeper },
    ),
    expeditionRoutes.leave.button({}, { label: "Leave", style: ButtonStyle.Danger }),
  );

  return { ...v2, _rows: [nodeRow, navRow] };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

async function renderTo(
  interaction: ButtonInteraction,
  state: ExpeditionState,
  ctx: Ctx,
  gatherLine?: string,
): Promise<void> {
  const toolTier = await getEquippedToolTier(ctx, interaction.user.id);
  const { _rows, ...v2Payload } = renderExpedition(state, toolTier, gatherLine);
  await interaction.editReply({ ...v2Payload, components: [...v2Payload.components, ..._rows] });
}

// ── Start ────────────────────────────────────────────────────────────────
export async function handleExpeditionStart(
  interaction: ButtonInteraction,
  { biome }: { biome: Biome },
  ctx: Ctx,
): Promise<void> {
  await interaction.deferUpdate();
  const state = startSession(interaction.user.id, biome);
  await renderTo(interaction, state, ctx);
}

// ── Gather ───────────────────────────────────────────────────────────────
export async function handleExpeditionGather(
  interaction: ButtonInteraction,
  { node: nodeId }: { node: string },
  ctx: Ctx,
): Promise<void> {
  await interaction.deferUpdate();

  const userId = interaction.user.id;
  const state = getSession(userId);
  if (!state) {
    await interaction.followUp({
      content: "Your expedition has expired. Use `/expedition` to start a new one.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const node = state.nodes.find((n) => n.id === nodeId);
  if (!node) {
    await interaction.followUp({
      content: "That resource has shifted. The area looks different now.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const locationId = locationForBiomeDepth(state.biome, state.depth);
  const action = actionForBiome(state.biome);
  const result = await gatherAtLocation(ctx, userId, action, locationId);

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
    await interaction.followUp({ content: msg, flags: MessageFlags.Ephemeral });
    return;
  }

  const { materialsGained, toolBroken, remainingDurability } = result.unwrap();
  const materialsText = materialsGained.map((m) => `+${m.quantity}× ${m.id}`).join(", ");
  const durabilityNote = toolBroken
    ? " 💥 *(tool broke!)*"
    : ` *(durability: ${remainingDurability})*`;
  const gatherLine = `✅ **${node.display}** → ${materialsText}${durabilityNote}`;

  const newState = regenNodes(userId) ?? state;
  await renderTo(interaction, newState, ctx, gatherLine);
}

// ── Go Deeper ─────────────────────────────────────────────────────────────
export async function handleExpeditionDeeper(
  interaction: ButtonInteraction,
  _args: Record<string, never>,
  ctx: Ctx,
): Promise<void> {
  await interaction.deferUpdate();
  const newState = advance(interaction.user.id);
  if (!newState) {
    await interaction.followUp({
      content: "You've reached the deepest point, or your session has expired.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await renderTo(interaction, newState, ctx);
}

// ── Leave ─────────────────────────────────────────────────────────────────
export async function handleExpeditionLeave(interaction: ButtonInteraction): Promise<void> {
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
