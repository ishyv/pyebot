/**
 * Dashboard renderer — shared by the `/tycoon view` command and the button/select
 * handlers so the screen is built in exactly one place.
 *
 * Returns a Components-V2 payload (`v2Message` output) whose top-level children
 * are the info container followed by the action rows.
 */

import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from "discord.js";
import { RpgProfile } from "@/components/rpg-profile";
import { UserFactory, type UserFactoryValue } from "@/components/user-factory";
import { UserInventory } from "@/components/user-inventory";
import { getBalance } from "@/features/economy/mutations";
import { getStashUsage } from "@/features/rpg/inventory";
import type { Ctx } from "@/framework/types";
import { container, separator, text, v2Message } from "@/ui/v2";
import { coins, progressBar } from "@/utils/fmt";
import { eventSeed, pendingOutput, rollEvent, upgradeCost } from "./accrual";
import { LINES, type LineId, STAGE_ORDER, type StageKind } from "./content/lines";

const STAGE_EMOJI: Record<StageKind, string> = {
  extractor: "⛏️",
  refinery: "🔥",
  assembler: "🔧",
};

function ratePerHour(n: number): string {
  return `${Math.round(n)}/h`;
}

interface StashStatus {
  readonly used: number;
  readonly max: number;
}

function lineBlock(
  userId: string,
  lineId: LineId,
  line: UserFactoryValue["lines"][string],
  now: number,
  stash: StashStatus,
): string {
  const def = LINES[lineId];
  const levels = {
    extractor: line.stages.extractor.level,
    refinery: line.stages.refinery.level,
    assembler: line.stages.assembler.level,
  };
  const pending = pendingOutput(
    def,
    { levels, mode: line.mode, automated: line.automated, lastCollectedAt: line.lastCollectedAt },
    now,
  );
  const { stageRates, bottleneck, rate } = pending.throughput;
  const event = rollEvent(eventSeed(userId, lineId, line.lastCollectedAt));
  const collectUnits = Math.floor(pending.units * event.multiplier);

  const modeTag = line.mode === "sell" ? "SELL → ⚜️" : "STOCKPILE → 📦";
  const autoTag = line.automated ? "👷 Automated" : "⏳ Manual";

  const stageLines = STAGE_ORDER.map((kind) => {
    const idle = line.mode === "stockpile" && kind === "assembler";
    const flag = !idle && kind === bottleneck ? "  🔴 bottleneck" : "";
    const idleNote = idle ? "  *(idle)*" : "";
    return `${STAGE_EMOJI[kind]} ${def.stages[kind].name} Lv${levels[kind]} — ${ratePerHour(stageRates[kind])}${flag}${idleNote}`;
  }).join("\n");

  const output =
    line.mode === "sell"
      ? `→ ${ratePerHour(rate)} × ${def.finishedGood.name} = ${coins(Math.round(rate) * def.finishedGood.scripValue, "scrip")}/h`
      : `→ ${ratePerHour(rate)} ${def.refinedMaterialId}`;

  const cap = rate * def.capHours;
  const fill = line.automated
    ? `${pending.units.toLocaleString()} stored (no cap)`
    : `${progressBar(pending.units, cap)} ${pending.units.toLocaleString()}/${Math.round(cap).toLocaleString()}${pending.capped ? " ⚠️ full" : ""}`;

  const notes: string[] = [];
  if (line.mode === "stockpile" && collectUnits > Math.max(0, stash.max - stash.used)) {
    notes.push(
      `⚠️ Stash blocked: ${collectUnits.toLocaleString()} ${def.refinedMaterialId} won't fit; clear stash or upgrade it before collecting.`,
    );
  }
  if (pending.units > 0 && event.id !== "none") {
    notes.push(`🎲 Event queued: ${event.label}`);
  }

  return `## 🏭 ${def.name}  [${modeTag}]  ${autoTag}\n${stageLines}\n${output}\n${fill}${notes.length ? `\n${notes.join("\n")}` : ""}`;
}

/** Builds the action rows: Collect All + Refresh, and an Upgrade select menu. */
function dashboardRows(
  factory: UserFactoryValue,
): ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] {
  const ownedIds = Object.keys(factory.lines) as LineId[];

  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("tycoon:collect:all")
      .setLabel("Collect All")
      .setStyle(ButtonStyle.Success)
      .setDisabled(ownedIds.length === 0),
    new ButtonBuilder()
      .setCustomId("tycoon:refresh")
      .setLabel("Refresh")
      .setStyle(ButtonStyle.Secondary),
  );

  const rows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [
    buttonRow as ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>,
  ];

  const upgradeOptions = ownedIds
    .flatMap((lineId) => {
      const line = factory.lines[lineId];
      const def = LINES[lineId];
      return STAGE_ORDER.map((stage) => {
        const level = line.stages[stage].level;
        const cost = upgradeCost(def.stages[stage], level);
        return {
          label: `${def.name} — ${def.stages[stage].name}`.slice(0, 100),
          description: `Lv ${level} → ${level + 1} · ${cost.toLocaleString()} coins`.slice(0, 100),
          value: `${lineId}:${stage}`,
        };
      });
    })
    .slice(0, 25);

  if (upgradeOptions.length > 0) {
    const select = new StringSelectMenuBuilder()
      .setCustomId("tycoon:upgrade")
      .setPlaceholder("🔧 Upgrade a stage…")
      .addOptions(upgradeOptions);
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select) as ActionRowBuilder<
        ButtonBuilder | StringSelectMenuBuilder
      >,
    );
  }

  const automatable = ownedIds.filter((id) => !factory.lines[id].automated);
  if (automatable.length > 0) {
    const select = new StringSelectMenuBuilder()
      .setCustomId("tycoon:automate")
      .setPlaceholder("👷 Hire automation…")
      .addOptions(
        automatable.map((id) => ({
          label: LINES[id].name.slice(0, 100),
          description:
            `${LINES[id].automationCost.toLocaleString()} coins · removes offline cap`.slice(
              0,
              100,
            ),
          value: id,
        })),
      );
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select) as ActionRowBuilder<
        ButtonBuilder | StringSelectMenuBuilder
      >,
    );
  }

  if (ownedIds.length > 0) {
    const select = new StringSelectMenuBuilder()
      .setCustomId("tycoon:mode")
      .setPlaceholder("🔁 Toggle sell / stockpile…")
      .addOptions(
        ownedIds.map((id) => {
          const next = factory.lines[id].mode === "sell" ? "stockpile" : "sell";
          return {
            label: `${LINES[id].name} → ${next}`.slice(0, 100),
            description: (next === "sell"
              ? "Sell finished goods for scrip"
              : "Stockpile refined material to stash"
            ).slice(0, 100),
            value: `${id}:${next}`,
          };
        }),
      );
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select) as ActionRowBuilder<
        ButtonBuilder | StringSelectMenuBuilder
      >,
    );
  }

  return rows;
}

/** Reads state and renders the full dashboard payload (container + rows). */
export async function renderDashboard(ctx: Ctx, userId: string) {
  const [factory, scrip, coinBalance, inventory, profile] = await Promise.all([
    ctx.ensure(userId, UserFactory),
    getBalance(ctx, userId, "scrip"),
    getBalance(ctx, userId, "coins"),
    ctx.get(userId, UserInventory),
    ctx.get(userId, RpgProfile),
  ]);

  const now = Date.now();
  const ownedIds = Object.keys(factory.lines) as LineId[];
  const stash = {
    used: getStashUsage(inventory?.slots ?? {}),
    max: profile?.stashSize ?? RpgProfile.schema.parse({}).stashSize,
  };

  const header = `# 🏛️ Guild Automated Works\n${coins(scrip, "scrip")}  •  ${coins(coinBalance)}`;

  const body =
    ownedIds.length === 0
      ? "You have no production lines yet.\nUse `/tycoon charter` to found your first one."
      : ownedIds.map((id) => lineBlock(userId, id, factory.lines[id], now, stash)).join("\n\n");

  const payload = v2Message(
    container(
      "info",
      text(header),
      separator("sm"),
      text(`${body}\n\n-# 💡 The 🔴 stage limits a line — upgrade it. /tycoon charter to expand.`),
    ),
    ...dashboardRows(factory),
  );
  return payload;
}
