/**
 * Dashboard interaction handler.
 *
 * CustomId scheme:
 *   tycoon:collect:all  — collect every owned line
 *   tycoon:refresh      — re-render the dashboard
 *   tycoon:upgrade      — string-select; value is `<lineId>:<stage>`
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
import { collect, upgrade } from "../operations";

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

  if (cid === "tycoon:collect:all") {
    await interaction.deferUpdate();
    const summary = await collectAll(ctx, userId);
    await refresh(interaction, ctx, userId);
    await interaction.followUp({ content: summary, flags: MessageFlags.Ephemeral });
    return;
  }

  if (cid === "tycoon:refresh") {
    await interaction.deferUpdate();
    await refresh(interaction, ctx, userId);
  }
}
