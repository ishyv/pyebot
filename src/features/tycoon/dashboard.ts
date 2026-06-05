/**
 * Dashboard renderer — shared by the `/tycoon play` command and the button/select
 * handlers so the screen is built in exactly one place.
 *
 * Returns a Components-V2 payload (`v2Message` output) whose top-level children
 * are the info container followed by the action rows.
 */

import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from "discord.js";
import { User } from "@/components/entities";
import { UserInventory } from "@/components/rpg/inventory";
import { RpgProfile } from "@/components/rpg-profile";
import { UserFactory, type UserFactoryValue } from "@/components/user-factory";
import { getBalance } from "@/features/economy/mutations";
import { getStashUsage } from "@/features/rpg/inventory";
import type { Ctx } from "@/framework/types";
import { container, separator, text, v2Message } from "@/ui/v2";
import { coins, progressBar } from "@/utils/fmt";
import { eventSeed, pendingOutput, rollEvent, upgradeCost } from "./accrual";
import {
  activeStagesForMode,
  LINES,
  type LineId,
  STAGE_ORDER,
  type StageKind,
} from "./content/lines";
import { netWorth } from "./operations";
import { tycoonRoutes } from "./routes";

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

interface SelectOption {
  readonly label: string;
  readonly description: string;
  readonly value: string;
}

interface LineConsoleState {
  readonly lineId: LineId;
  readonly line: UserFactoryValue["lines"][string];
  readonly bottleneck: StageKind;
  readonly rate: number;
  readonly pendingUnits: number;
  readonly collectUnits: number;
  readonly capped: boolean;
  readonly status: string;
  readonly stashBlocked: boolean;
  readonly capUnits: number;
  readonly fill: string;
  readonly stageRates: Record<StageKind, number>;
  readonly eventLabel: string | null;
}

interface PrimaryAction {
  readonly label: string;
  readonly customId: string;
}

interface ConsoleBriefing {
  readonly line: string;
  /** The single best next action as a one-tap button, mirroring `line`. Null when the obvious action already has its own button (collect) or none applies. */
  readonly primaryAction: PrimaryAction | null;
  readonly upgradeOptions: readonly SelectOption[];
  readonly expansionOptions: readonly SelectOption[];
  readonly outputOptions: readonly SelectOption[];
  readonly readyLines: readonly LineConsoleState[];
  readonly readyLabel: string;
}

function levelsOf(line: UserFactoryValue["lines"][string]): Record<StageKind, number> {
  return {
    extractor: line.stages.extractor.level,
    refinery: line.stages.refinery.level,
    assembler: line.stages.assembler.level,
  };
}

function lineState(
  userId: string,
  lineId: LineId,
  line: UserFactoryValue["lines"][string],
  now: number,
  stash: StashStatus,
): LineConsoleState {
  const def = LINES[lineId];
  const levels = levelsOf(line);
  const pending = pendingOutput(
    def,
    { levels, mode: line.mode, automated: line.automated, lastCollectedAt: line.lastCollectedAt },
    now,
  );
  const { stageRates, bottleneck, rate } = pending.throughput;
  const event = rollEvent(eventSeed(userId, lineId, line.lastCollectedAt));
  const collectUnits = Math.floor(pending.units * event.multiplier);
  const cap = rate * def.capHours;
  const fill = line.automated
    ? `${pending.units.toLocaleString()} stored (no cap)`
    : `${progressBar(pending.units, cap)} ${pending.units.toLocaleString()}/${Math.round(cap).toLocaleString()}${pending.capped ? " ⚠️ full" : ""}`;
  const stashBlocked =
    line.mode === "stockpile" && collectUnits > Math.max(0, stash.max - stash.used);
  const status = line.automated
    ? "👷 Automated"
    : pending.capped
      ? "⚠️ Manual full"
      : pending.units > 0
        ? "📦 Ready"
        : "⏳ Manual running";

  return {
    lineId,
    line,
    bottleneck,
    rate,
    pendingUnits: pending.units,
    collectUnits,
    capped: pending.capped,
    status,
    stashBlocked,
    capUnits: cap,
    fill,
    stageRates,
    eventLabel: pending.units > 0 && event.id !== "none" ? event.label : null,
  };
}

function lineBlock(state: LineConsoleState): string {
  const def = LINES[state.lineId];
  const levels = levelsOf(state.line);
  const modeTag = state.line.mode === "sell" ? "SELL → ⚜️" : "STOCKPILE → 📦";
  const stageLines = STAGE_ORDER.map((kind) => {
    const idle = state.line.mode === "stockpile" && kind === "assembler";
    const flag = !idle && kind === state.bottleneck ? " 🔴" : "";
    const idleNote = idle ? " idle" : "";
    return `${STAGE_EMOJI[kind]} Lv${levels[kind]} ${ratePerHour(state.stageRates[kind])}${flag}${idleNote}`;
  }).join("  ");
  const output =
    state.line.mode === "sell"
      ? `${ratePerHour(state.rate)} ${def.finishedGood.name} (${coins(Math.round(state.rate) * def.finishedGood.scripValue, "scrip")}/h)`
      : `${ratePerHour(state.rate)} ${def.refinedMaterialId}`;
  // Next milestone for the bottleneck stage — the "numbers go up soon" goal.
  // Output doubles every `milestoneEvery` levels (see accrual.milestoneMult).
  const me = def.milestoneEvery;
  const blLevel = levels[state.bottleneck];
  const nextMilestoneLevel = (Math.floor((blLevel - 1) / me) + 1) * me + 1;
  const toNext = nextMilestoneLevel - blLevel;
  const milestoneNote = ` • Next ×2: Lv${nextMilestoneLevel} (+${toNext})`;

  const notes: string[] = [];
  if (state.stashBlocked) {
    notes.push(
      `⚠️ Stash blocked: ${state.collectUnits.toLocaleString()} ${def.refinedMaterialId} won't fit; clear stash or upgrade it before collecting.`,
    );
  }
  if (state.capped && !state.line.automated) {
    // Storage is full, so anything produced past the cap is lost — quantify it.
    notes.push(`💸 Storage full — ~${ratePerHour(state.rate)} idle. Collect or automate.`);
  }
  if (state.eventLabel) notes.push(`🎲 Event queued: ${state.eventLabel}`);

  return `## 🏭 ${def.name}  [${modeTag}]  ${state.status}\n${stageLines}\n→ ${output}\nBottleneck: 🔴 ${def.stages[state.bottleneck].name} • Pending: ${state.fill}${milestoneNote}${notes.length ? `\n${notes.join("\n")}` : ""}`;
}

function optionUrgency(state: LineConsoleState): number {
  if (state.stashBlocked) return 0;
  if (state.capped) return 1;
  if (state.collectUnits > 0) return 2;
  return 3;
}

/**
 * Builds the state-prioritized console controls and shift briefing.
 * Assumes the caller has already loaded trusted component state for the user.
 */
export function buildConsoleBriefing(
  userId: string,
  factory: UserFactoryValue,
  now: number,
  stash: StashStatus,
): ConsoleBriefing {
  const ownedIds = Object.keys(factory.lines) as LineId[];
  const states = ownedIds.map((id) => lineState(userId, id, factory.lines[id], now, stash));
  const readyLines = states.filter((state) => state.collectUnits > 0);
  const blocked = states.find((state) => state.stashBlocked);
  const nextLine = (Object.keys(LINES) as LineId[]).find((id) => !factory.lines[id]);

  const upgradeOptions = states
    .flatMap((state) => {
      const def = LINES[state.lineId];
      const active = activeStagesForMode(state.line.mode);
      return STAGE_ORDER.map((stage) => {
        const level = state.line.stages[stage].level;
        const cost = upgradeCost(def.stages[stage], level);
        const isBottleneck = active.includes(stage) && stage === state.bottleneck;
        return {
          label: `${isBottleneck ? "Fix " : ""}${def.name} — ${def.stages[stage].name}`.slice(
            0,
            100,
          ),
          description:
            `${isBottleneck ? "Bottleneck · " : ""}Lv ${level} → ${level + 1} · ${cost.toLocaleString()} coins`.slice(
              0,
              100,
            ),
          value: `${state.lineId}:${stage}`,
          priority: (isBottleneck ? 0 : 10) + optionUrgency(state),
        };
      });
    })
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 25)
    .map(({ priority: _priority, ...option }) => option);

  const charterOptions = (Object.keys(LINES) as LineId[])
    .filter((id) => !factory.lines[id])
    .map((id) => ({
      label: `Charter ${LINES[id].name}`.slice(0, 100),
      description: `Tier ${LINES[id].tier} · ${LINES[id].charterCost.toLocaleString()} coins`.slice(
        0,
        100,
      ),
      value: `charter:${id}`,
    }));
  const automationOptions = ownedIds
    .filter((id) => !factory.lines[id].automated)
    .map((id) => ({
      label: `Automate ${LINES[id].name}`.slice(0, 100),
      description: `${LINES[id].automationCost.toLocaleString()} coins · removes offline cap`.slice(
        0,
        100,
      ),
      value: `automate:${id}`,
    }));
  const outputOptions = ownedIds.map((id) => {
    const next = factory.lines[id].mode === "sell" ? "stockpile" : "sell";
    return {
      label: `${LINES[id].name} → ${next}`.slice(0, 100),
      description: (next === "sell"
        ? "Sell finished goods for scrip"
        : "Stockpile refined material to stash"
      ).slice(0, 100),
      value: `${id}:${next}`,
    };
  });

  // The briefing string and the one-tap primaryAction are derived together so
  // the screen says what to do AND lets the player do it in a single click.
  let primaryAction: PrimaryAction | null = null;
  const briefing = (() => {
    if (ownedIds.length === 0) {
      const first = (Object.keys(LINES) as LineId[])[0];
      primaryAction = {
        label: `🏛️ Charter ${LINES[first].name} (${LINES[first].charterCost.toLocaleString()})`,
        customId: tycoonRoutes["do-charter"].id({ line: first }),
      };
      return `🎯 Charter ${LINES[first].name} to start. The loop: collect output, upgrade the slowest stage, expand into new lines.`;
    }
    if (blocked) {
      // Several valid fixes (clear/upgrade stash, switch output) — no single button.
      return `⚠️ Stash blocked at ${LINES[blocked.lineId].name}. Clear stash, upgrade it, or switch output before collecting.`;
    }
    if (readyLines.length > 0) {
      // The dedicated "Collect Ready" button already covers this.
      return `📦 Collect ready output from ${readyLines.length} line${readyLines.length === 1 ? "" : "s"}.`;
    }
    const capped = states.find((state) => state.capped && !state.line.automated);
    if (capped) {
      primaryAction = {
        label: `👷 Automate ${LINES[capped.lineId].name} (${LINES[capped.lineId].automationCost.toLocaleString()})`,
        customId: tycoonRoutes["do-automate"].id({ line: capped.lineId }),
      };
      return `👷 Automate ${LINES[capped.lineId].name} soon; manual storage is full.`;
    }
    const fix = states[0];
    if (fix) {
      const stageDef = LINES[fix.lineId].stages[fix.bottleneck];
      const cost = upgradeCost(stageDef, fix.line.stages[fix.bottleneck].level);
      primaryAction = {
        label: `🔧 Fix ${stageDef.name} (${cost.toLocaleString()})`,
        customId: tycoonRoutes["do-upgrade"].id({ line: fix.lineId, stage: fix.bottleneck }),
      };
      return `🔧 Fix bottleneck: upgrade ${LINES[fix.lineId].name} ${stageDef.name}.`;
    }
    if (nextLine) {
      primaryAction = {
        label: `🏛️ Charter ${LINES[nextLine].name} (${LINES[nextLine].charterCost.toLocaleString()})`,
        customId: tycoonRoutes["do-charter"].id({ line: nextLine }),
      };
      return `🏛️ Charter ${LINES[nextLine].name} when you want a new production chain.`;
    }
    return "⏳ All works are running. Come back when output is ready.";
  })();

  const readyScrip = readyLines.reduce((sum, state) => {
    if (state.line.mode !== "sell") return sum;
    return sum + state.collectUnits * LINES[state.lineId].finishedGood.scripValue;
  }, 0);
  const readyMaterials = readyLines.reduce(
    (sum, state) => sum + (state.line.mode === "stockpile" ? state.collectUnits : 0),
    0,
  );

  return {
    line: briefing,
    primaryAction,
    upgradeOptions,
    expansionOptions: [...charterOptions, ...automationOptions].slice(0, 25),
    outputOptions: outputOptions.slice(0, 25),
    readyLines,
    readyLabel:
      readyScrip > 0
        ? `${coins(readyScrip, "scrip")} ready`
        : readyMaterials > 0
          ? `${readyMaterials.toLocaleString()} materials ready`
          : "No output ready",
  };
}

function dashboardRows(
  briefing: ConsoleBriefing,
  scrip: number,
): ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];

  const buttons: ButtonBuilder[] = [];
  if (briefing.primaryAction) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(briefing.primaryAction.customId)
        .setLabel(briefing.primaryAction.label.slice(0, 80))
        .setStyle(ButtonStyle.Primary),
    );
  }
  if (briefing.readyLines.length > 0) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(tycoonRoutes.collect.id({}))
        .setLabel("Collect Ready")
        .setStyle(ButtonStyle.Success),
    );
  }
  buttons.push(
    new ButtonBuilder()
      .setCustomId(tycoonRoutes.refresh.id({}))
      .setLabel("Refresh")
      .setStyle(ButtonStyle.Secondary),
  );
  if (scrip > 0) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(tycoonRoutes.exchange.id({}))
        .setLabel("Exchange")
        .setStyle(ButtonStyle.Primary),
    );
  }
  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons);
  rows.push(buttonRow as ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>);

  if (briefing.upgradeOptions.length > 0) {
    const select = new StringSelectMenuBuilder()
      .setCustomId(tycoonRoutes.upgrade.id({}))
      .setPlaceholder("Fix bottleneck...")
      .addOptions([...briefing.upgradeOptions]);
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select) as ActionRowBuilder<
        ButtonBuilder | StringSelectMenuBuilder
      >,
    );
  }

  if (briefing.expansionOptions.length > 0) {
    const select = new StringSelectMenuBuilder()
      .setCustomId(tycoonRoutes.expand.id({}))
      .setPlaceholder("Expand or automate...")
      .addOptions([...briefing.expansionOptions]);
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select) as ActionRowBuilder<
        ButtonBuilder | StringSelectMenuBuilder
      >,
    );
  }

  if (briefing.outputOptions.length > 0) {
    const select = new StringSelectMenuBuilder()
      .setCustomId(tycoonRoutes.mode.id({}))
      .setPlaceholder("Manage output...")
      .addOptions([...briefing.outputOptions]);
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
  const [factory, scrip, coinBalance, worth, inventory, profile] = await Promise.all([
    ctx.ensure(userId, UserFactory),
    getBalance(ctx, userId, "scrip"),
    getBalance(ctx, userId, "coins"),
    netWorth(ctx, userId),
    ctx.of(User, userId).peek(UserInventory),
    ctx.get(userId, RpgProfile),
  ]);

  const now = Date.now();
  const ownedIds = Object.keys(factory.lines) as LineId[];
  const stash = {
    used: getStashUsage(inventory?.slots ?? {}),
    max: profile?.stashSize ?? RpgProfile.schema.parse({}).stashSize,
  };
  const briefing = buildConsoleBriefing(userId, factory, now, stash);

  const header = `# 🏛️ Guild Automated Works\n${coins(scrip, "scrip")}  •  ${coins(coinBalance)}  •  Net worth: ${coins(worth)}\nLines: ${ownedIds.length}/${Object.keys(LINES).length}  •  Ready: ${briefing.readyLabel}`;

  const body =
    ownedIds.length === 0
      ? "No lines chartered yet."
      : ownedIds
          .map((id) => lineBlock(lineState(userId, id, factory.lines[id], now, stash)))
          .join("\n\n");

  const payload = v2Message(
    container(
      "info",
      text(header),
      separator("sm"),
      text(`## Shift Briefing\n${briefing.line}`),
      separator("sm"),
      text(
        `${body}\n\n-# Advanced: Fix bottleneck with the select, or use /tycoon collect, /tycoon upgrade, /tycoon exchange.`,
      ),
    ),
    ...dashboardRows(briefing, scrip),
  );
  return payload;
}
