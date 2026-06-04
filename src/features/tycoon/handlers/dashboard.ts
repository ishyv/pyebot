/**
 * Dashboard interaction handlers — one exported function per route (see
 * ../routes.ts). Buttons (collect / refresh / exchange / the do-* one-tap
 * actions) and the exchange modal are typed directly; the upgrade / expand /
 * mode select menus read their choice from interaction.values, so those routes
 * carry no customId args.
 *
 * All interactions update the original ephemeral dashboard in place via
 * deferUpdate + editReply, mirroring the expedition handler.
 */

import {
  ActionRowBuilder,
  type ButtonInteraction,
  MessageFlags,
  ModalBuilder,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { UserFactory } from "@/components/user-factory";
import type { Ctx } from "@/framework/types";
import { coins } from "@/utils/fmt";
import { LINES, type LineId, parseLineId, type StageKind } from "../content/lines";
import { renderDashboard } from "../dashboard";
import {
  automate,
  charter,
  collect,
  EXCHANGE_FEE,
  exchange,
  getScrip,
  SCRIP_TO_COINS_RATE,
  setMode,
  upgrade,
} from "../operations";
import { tycoonRoutes } from "../routes";

type TycoonInteraction = ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction;

/** Modal that collects how much scrip to convert at the Guild Exchange. */
function buildExchangeModal(scrip: number): ModalBuilder {
  const coinsEach = SCRIP_TO_COINS_RATE * (1 - EXCHANGE_FEE);
  return new ModalBuilder()
    .setCustomId(tycoonRoutes["exchange-submit"].id({}))
    .setTitle("Guild Exchange")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("amount")
          .setLabel("Scrip to convert")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder(
            `You have ${scrip.toLocaleString()} · ${coinsEach} coins each (−${Math.round(EXCHANGE_FEE * 100)}% fee)`,
          ),
      ),
    );
}

const STAGES: readonly StageKind[] = ["extractor", "refinery", "assembler"];

async function refresh(interaction: TycoonInteraction, ctx: Ctx, userId: string): Promise<void> {
  const payload = await renderDashboard(ctx, userId);
  await interaction.editReply(payload);
}

/** Re-render the dashboard, then surface an optional operation error as a toast. */
async function refreshThen(
  interaction: TycoonInteraction,
  ctx: Ctx,
  userId: string,
  errMsg: string | null,
): Promise<void> {
  await refresh(interaction, ctx, userId);
  if (errMsg) {
    await interaction.followUp({ content: `❌ ${errMsg}`, flags: MessageFlags.Ephemeral });
  }
}

const errOf = (result: { isErr(): boolean; error: { message: string } }): string | null =>
  result.isErr() ? result.error.message : null;

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

// ── Select menus (payload in interaction.values) ───────────────────────────

export async function handleUpgradeSelect(
  interaction: StringSelectMenuInteraction,
  _args: Record<string, never>,
  ctx: Ctx,
): Promise<void> {
  await interaction.deferUpdate();
  const userId = interaction.user.id;
  const [lineRaw, stageRaw] = (interaction.values[0] ?? "").split(":");
  const lineId = parseLineId(lineRaw);
  const stage = STAGES.includes(stageRaw as StageKind) ? (stageRaw as StageKind) : null;
  const errMsg = lineId && stage ? errOf(await upgrade(ctx, userId, lineId, stage)) : null;
  await refreshThen(interaction, ctx, userId, errMsg);
}

export async function handleExpandSelect(
  interaction: StringSelectMenuInteraction,
  _args: Record<string, never>,
  ctx: Ctx,
): Promise<void> {
  await interaction.deferUpdate();
  const userId = interaction.user.id;
  const [action, rawLine] = (interaction.values[0] ?? "").split(":");
  const lineId = parseLineId(rawLine);
  let errMsg: string | null = null;
  if (lineId && action === "charter") errMsg = errOf(await charter(ctx, userId, lineId));
  else if (lineId && action === "automate") errMsg = errOf(await automate(ctx, userId, lineId));
  await refreshThen(interaction, ctx, userId, errMsg);
}

export async function handleModeSelect(
  interaction: StringSelectMenuInteraction,
  _args: Record<string, never>,
  ctx: Ctx,
): Promise<void> {
  await interaction.deferUpdate();
  const userId = interaction.user.id;
  const [lineRaw, modeRaw] = (interaction.values[0] ?? "").split(":");
  const lineId = parseLineId(lineRaw);
  const mode = modeRaw === "sell" || modeRaw === "stockpile" ? modeRaw : null;
  if (lineId && mode) await setMode(ctx, userId, lineId, mode);
  await refresh(interaction, ctx, userId);
}

// ── One-tap "next action" buttons ───────────────────────────────────────────

export async function handleDoUpgrade(
  interaction: ButtonInteraction,
  { line, stage }: { line: string; stage: StageKind },
  ctx: Ctx,
): Promise<void> {
  await interaction.deferUpdate();
  const userId = interaction.user.id;
  const lineId = parseLineId(line);
  const errMsg = lineId ? errOf(await upgrade(ctx, userId, lineId, stage)) : null;
  await refreshThen(interaction, ctx, userId, errMsg);
}

export async function handleDoAutomate(
  interaction: ButtonInteraction,
  { line }: { line: string },
  ctx: Ctx,
): Promise<void> {
  await interaction.deferUpdate();
  const userId = interaction.user.id;
  const lineId = parseLineId(line);
  const errMsg = lineId ? errOf(await automate(ctx, userId, lineId)) : null;
  await refreshThen(interaction, ctx, userId, errMsg);
}

export async function handleDoCharter(
  interaction: ButtonInteraction,
  { line }: { line: string },
  ctx: Ctx,
): Promise<void> {
  await interaction.deferUpdate();
  const userId = interaction.user.id;
  const lineId = parseLineId(line);
  const errMsg = lineId ? errOf(await charter(ctx, userId, lineId)) : null;
  await refreshThen(interaction, ctx, userId, errMsg);
}

// ── Standalone buttons + modal ──────────────────────────────────────────────

export async function handleCollect(
  interaction: ButtonInteraction,
  _args: Record<string, never>,
  ctx: Ctx,
): Promise<void> {
  await interaction.deferUpdate();
  const userId = interaction.user.id;
  const summary = await collectAll(ctx, userId);
  await refresh(interaction, ctx, userId);
  await interaction.followUp({ content: summary, flags: MessageFlags.Ephemeral });
}

export async function handleRefresh(
  interaction: ButtonInteraction,
  _args: Record<string, never>,
  ctx: Ctx,
): Promise<void> {
  await interaction.deferUpdate();
  await refresh(interaction, ctx, interaction.user.id);
}

export async function handleExchangeButton(
  interaction: ButtonInteraction,
  _args: Record<string, never>,
  ctx: Ctx,
): Promise<void> {
  const scrip = await getScrip(ctx, interaction.user.id);
  if (scrip <= 0) {
    await interaction.reply({
      content: "🏦 No scrip is ready for exchange yet.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  // Opening a modal must NOT be preceded by deferUpdate.
  await interaction.showModal(buildExchangeModal(scrip));
}

export async function handleExchangeSubmit(
  interaction: ModalSubmitInteraction,
  _args: Record<string, never>,
  ctx: Ctx,
): Promise<void> {
  await interaction.deferUpdate();
  const userId = interaction.user.id;
  const raw = interaction.fields.getTextInputValue("amount").trim();
  const amount = Number.parseInt(raw, 10);
  if (!Number.isFinite(amount) || amount <= 0) {
    await interaction.followUp({
      content: "❌ Enter a positive whole number of scrip.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const result = await exchange(ctx, userId, amount);
  await refresh(interaction, ctx, userId);
  await interaction.followUp({
    content: result.isErr()
      ? `❌ ${result.error.message}`
      : `🏦 Converted ${coins(result.unwrap().scripSpent, "scrip")} → ${coins(result.unwrap().coinsGained)}.`,
    flags: MessageFlags.Ephemeral,
  });
}
