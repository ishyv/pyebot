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

type TycoonInteraction = ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction;

/** Modal that collects how much scrip to convert at the Guild Exchange. */
function buildExchangeModal(scrip: number): ModalBuilder {
  const coinsEach = SCRIP_TO_COINS_RATE * (1 - EXCHANGE_FEE);
  return new ModalBuilder()
    .setCustomId("tycoon:exchange:submit")
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
  interaction: TycoonInteraction,
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

  if (cid === "tycoon:exchange" && interaction.isButton()) {
    const scrip = await getScrip(ctx, userId);
    if (scrip <= 0) {
      await interaction.reply({
        content: "🏦 No scrip is ready for exchange yet.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    // Opening a modal must NOT be preceded by deferUpdate.
    await interaction.showModal(buildExchangeModal(scrip));
    return;
  }

  if (cid === "tycoon:exchange:submit" && interaction.isModalSubmit()) {
    await interaction.deferUpdate();
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
    return;
  }
}
