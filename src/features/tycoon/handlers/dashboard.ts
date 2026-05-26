/**
 * Dashboard interaction handler.
 *
 * CustomId scheme:
 *   tycoon:collect:ready — collect every ready owned line
 *   tycoon:refresh      — re-render the dashboard
 *   tycoon:upgrade      — string-select; value is `<lineId>:<stage>`
 *   tycoon:expand       — string-select; value is `charter:<lineId>` or `automate:<lineId>`
 *   tycoon:mode         — string-select; value is `<lineId>:<mode>`
 *
 * All interactions update the original ephemeral dashboard in place via
 * deferUpdate + editReply, mirroring the expedition handler.
 */

import { type ButtonInteraction, MessageFlags, type StringSelectMenuInteraction } from "discord.js";
import { UserFactory } from "@/components/user-factory";
import type { Ctx } from "@/framework/types";
import { coins } from "@/utils/fmt";
import { LINES, type LineId, parseLineId, type StageKind } from "../content/lines";
import { renderDashboard } from "../dashboard";
import { automate, charter, collect, getScrip, setMode, upgrade } from "../operations";

const STAGES: readonly StageKind[] = ["extractor", "refinery", "assembler"];

async function refresh(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  ctx: Ctx,
  userId: string,
): Promise<void> {
  const payload = await renderDashboard(ctx, userId);
  await interaction.editReply(payload);
}

async function collectAll(ctx: Ctx, userId: string): Promise<string> {
  const factory = await ctx.get(userId, UserFactory);
  const ids = Object.keys(factory?.lines ?? {}) as LineId[];
  const parts: string[] = [];
  let totalScrip = 0;
  for (const id of ids) {
    const result = await collect(ctx, userId, id);
    if (result.isOk()) {
      const s = result.unwrap();
      totalScrip += s.scripGained;
      const reward =
        s.mode === "sell" ? coins(s.scripGained, "scrip") : `${s.materialsGained}× ${s.materialId}`;
      parts.push(`${LINES[id].name}: ${reward}${s.event.label ? ` ${s.event.label}` : ""}`);
    }
  }
  if (parts.length === 0) return "Nothing was ready to collect yet.";
  return `📦 Collected:\n${parts.join("\n")}\n\nTotal: ${coins(totalScrip, "scrip")}`;
}

export async function handleTycoonComponent(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  ctx: Ctx,
): Promise<void> {
  const userId = interaction.user.id;
  const cid = interaction.customId;

  if (cid === "tycoon:upgrade" && interaction.isStringSelectMenu()) {
    await interaction.deferUpdate();
    const [lineRaw, stageRaw] = (interaction.values[0] ?? "").split(":");
    const lineId = parseLineId(lineRaw);
    const stage = STAGES.includes(stageRaw as StageKind) ? (stageRaw as StageKind) : null;
    if (lineId && stage) {
      const result = await upgrade(ctx, userId, lineId, stage);
      if (result.isErr()) {
        await interaction.followUp({
          content: `❌ ${result.error.message}`,
          flags: MessageFlags.Ephemeral,
        });
      }
    }
    await refresh(interaction, ctx, userId);
    return;
  }

  if (cid === "tycoon:expand" && interaction.isStringSelectMenu()) {
    await interaction.deferUpdate();
    const [action, rawLine] = (interaction.values[0] ?? "").split(":");
    const lineId = parseLineId(rawLine);
    if (lineId && action === "charter") {
      const result = await charter(ctx, userId, lineId);
      if (result.isErr()) {
        await interaction.followUp({
          content: `❌ ${result.error.message}`,
          flags: MessageFlags.Ephemeral,
        });
      }
    } else if (lineId && action === "automate") {
      const result = await automate(ctx, userId, lineId);
      if (result.isErr()) {
        await interaction.followUp({
          content: `❌ ${result.error.message}`,
          flags: MessageFlags.Ephemeral,
        });
      }
    }
    await refresh(interaction, ctx, userId);
    return;
  }

  if (cid === "tycoon:automate" && interaction.isStringSelectMenu()) {
    await interaction.deferUpdate();
    const lineId = parseLineId(interaction.values[0]);
    if (lineId) {
      const result = await automate(ctx, userId, lineId);
      if (result.isErr()) {
        await interaction.followUp({
          content: `❌ ${result.error.message}`,
          flags: MessageFlags.Ephemeral,
        });
      }
    }
    await refresh(interaction, ctx, userId);
    return;
  }

  if (cid === "tycoon:mode" && interaction.isStringSelectMenu()) {
    await interaction.deferUpdate();
    const [lineRaw, modeRaw] = (interaction.values[0] ?? "").split(":");
    const lineId = parseLineId(lineRaw);
    const mode = modeRaw === "sell" || modeRaw === "stockpile" ? modeRaw : null;
    if (lineId && mode) await setMode(ctx, userId, lineId, mode);
    await refresh(interaction, ctx, userId);
    return;
  }

  if (cid === "tycoon:collect:ready" || cid === "tycoon:collect:all") {
    await interaction.deferUpdate();
    const summary = await collectAll(ctx, userId);
    await refresh(interaction, ctx, userId);
    await interaction.followUp({ content: summary, flags: MessageFlags.Ephemeral });
    return;
  }

  if (cid === "tycoon:refresh") {
    await interaction.deferUpdate();
    await refresh(interaction, ctx, userId);
    return;
  }

  if (cid === "tycoon:exchange") {
    await interaction.deferUpdate();
    const scrip = await getScrip(ctx, userId);
    await refresh(interaction, ctx, userId);
    await interaction.followUp({
      content:
        scrip > 0
          ? `🏦 Use \`/tycoon exchange amount:${scrip}\` to convert all current scrip, or enter a smaller amount.`
          : "🏦 No scrip is ready for exchange yet.",
      flags: MessageFlags.Ephemeral,
    });
  }
}
