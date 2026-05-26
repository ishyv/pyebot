import {
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { UserFactory } from "@/components/user-factory";
import { defineCommand } from "@/framework";
import type { Ctx } from "@/framework/types";
import { container, separator, text, v2Message } from "@/ui/v2";
import { coins } from "@/utils/fmt";
import { LINES, type LineId, parseLineId, type StageKind } from "../content/lines";
import { renderDashboard } from "../dashboard";
import {
  automate,
  type CollectSummary,
  charter,
  collect,
  EXCHANGE_FEE,
  exchange,
  getLifetimeScrip,
  setMode,
  topMagnates,
  upgrade,
} from "../operations";

const STAGE_CHOICES = [
  { name: "Extractor", value: "extractor" },
  { name: "Refinery", value: "refinery" },
  { name: "Assembler", value: "assembler" },
];

const data = new SlashCommandBuilder()
  .setName("tycoon")
  .setDescription("Manage your automated production lines")
  .addSubcommand((s) => s.setName("view").setDescription("Open your production dashboard"))
  .addSubcommand((s) =>
    s
      .setName("charter")
      .setDescription("Charter (buy) a new production line")
      .addStringOption((o) =>
        o
          .setName("line")
          .setDescription("Which line to charter")
          .setRequired(true)
          .setAutocomplete(true),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName("collect")
      .setDescription("Collect pending output from your lines")
      .addStringOption((o) =>
        o
          .setName("line")
          .setDescription("A specific line (default: all lines)")
          .setAutocomplete(true),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName("upgrade")
      .setDescription("Upgrade one stage of a line by a level")
      .addStringOption((o) =>
        o.setName("line").setDescription("Which line").setRequired(true).setAutocomplete(true),
      )
      .addStringOption((o) =>
        o
          .setName("stage")
          .setDescription("Which stage to upgrade")
          .setRequired(true)
          .addChoices(...STAGE_CHOICES),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName("automate")
      .setDescription("Hire an automation module so a line never hits its offline cap")
      .addStringOption((o) =>
        o.setName("line").setDescription("Which line").setRequired(true).setAutocomplete(true),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName("mode")
      .setDescription("Set a line to sell for scrip or stockpile refined materials")
      .addStringOption((o) =>
        o.setName("line").setDescription("Which line").setRequired(true).setAutocomplete(true),
      )
      .addStringOption((o) =>
        o
          .setName("mode")
          .setDescription("Output mode")
          .setRequired(true)
          .addChoices(
            { name: "Sell for scrip", value: "sell" },
            { name: "Stockpile materials", value: "stockpile" },
          ),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName("exchange")
      .setDescription("Convert scrip to coins at the Guild Exchange")
      .addIntegerOption((o) =>
        o
          .setName("amount")
          .setDescription("How much scrip to convert")
          .setRequired(true)
          .setMinValue(1),
      ),
  )
  .addSubcommand((s) => s.setName("leaderboard").setDescription("See the richest Guild magnates"));

/**
 * Autocomplete label for a line, annotated with the price relevant to the
 * action so users see the cost before committing (Discord shows `name`, not
 * `value`). Capped at Discord's 100-char choice-name limit.
 */
function lineChoiceLabel(id: LineId, sub: string): string {
  const def = LINES[id];
  if (sub === "charter") {
    return `${def.name} (T${def.tier}) · 🪙 ${def.charterCost.toLocaleString()}`.slice(0, 100);
  }
  if (sub === "automate") {
    return `${def.name} · 🪙 ${def.automationCost.toLocaleString()} automation`.slice(0, 100);
  }
  return def.name.slice(0, 100);
}

async function autocomplete(interaction: AutocompleteInteraction, ctx: Ctx): Promise<void> {
  const focused = interaction.options.getFocused().toLowerCase();
  const sub = interaction.options.getSubcommand();

  const owned = (await ctx.get(interaction.user.id, UserFactory))?.lines ?? {};
  const ids = (Object.keys(LINES) as LineId[]).filter((id) => {
    if (sub === "charter") return !owned[id];
    if (sub === "automate") return Boolean(owned[id]) && !owned[id].automated;
    return Boolean(owned[id]);
  });

  const choices = ids
    .filter((id) => id.includes(focused) || LINES[id].name.toLowerCase().includes(focused))
    .slice(0, 25)
    .map((id) => ({ name: lineChoiceLabel(id, sub), value: id }));
  await interaction.respond(choices);
}

async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  await ctx.respond.defer({ visibility: "ephemeral" });
  if (!interaction.guild) {
    await ctx.respond.send({ content: "This command can only be used in a server." });
    return;
  }

  const sub = interaction.options.getSubcommand();
  if (sub === "view") await handleView(interaction, ctx);
  else if (sub === "charter") await handleCharter(interaction, ctx);
  else if (sub === "collect") await handleCollect(interaction, ctx);
  else if (sub === "upgrade") await handleUpgrade(interaction, ctx);
  else if (sub === "automate") await handleAutomate(interaction, ctx);
  else if (sub === "mode") await handleMode(interaction, ctx);
  else if (sub === "exchange") await handleExchange(interaction, ctx);
  else if (sub === "leaderboard") await handleLeaderboard(interaction, ctx);
}

async function handleLeaderboard(
  interaction: ChatInputCommandInteraction,
  ctx: Ctx,
): Promise<void> {
  const [top, own] = await Promise.all([
    topMagnates(ctx, 10),
    getLifetimeScrip(ctx, interaction.user.id),
  ]);

  if (top.length === 0) {
    await ctx.respond.send(
      v2Message(
        container(
          "info",
          text("## 🏆 Guild Magnates\nNo magnates yet — be the first to build an empire."),
        ),
      ),
    );
    return;
  }

  const medals = ["🥇", "🥈", "🥉"];
  const rows = top.map((entry, i) => {
    const rank = medals[i] ?? `**${i + 1}.**`;
    return `${rank} <@${entry.userId}> — ${coins(entry.lifetimeScrip, "scrip")}`;
  });

  const ownRank = top.findIndex((e) => e.userId === interaction.user.id);
  const ownLine =
    ownRank === -1 ? `\n\n-# You: ${coins(own, "scrip")} lifetime` : "\n\n-# That's you!";

  await ctx.respond.send(
    v2Message(
      container(
        "info",
        text("# 🏆 Guild Magnates"),
        separator("sm"),
        text(`${rows.join("\n")}${ownLine}`),
      ),
    ),
  );
}

async function handleView(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  const payload = await renderDashboard(ctx, interaction.user.id);
  await ctx.respond.send(payload);
}

function fail(ctx: Ctx, body: string): Promise<unknown> {
  return ctx.respond.send(v2Message(container("danger", text(body))));
}

async function handleCharter(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  const lineId = parseLineId(interaction.options.getString("line", true));
  if (!lineId) {
    await fail(ctx, "## ❌ Unknown line\nPick one from the list.");
    return;
  }
  const def = LINES[lineId];
  const result = await charter(ctx, interaction.user.id, lineId);
  if (result.isErr()) {
    await fail(ctx, `## ❌ Couldn't charter ${def.name}\n${result.error.message}`);
    return;
  }
  await ctx.respond.send(
    v2Message(
      container(
        "ok",
        text(
          `## 🏛️ Chartered ${def.name}!\nCost: ${coins(result.unwrap().charterCost)}\n\nIt's running in **sell** mode. Use \`/tycoon collect\` to gather scrip, and \`/tycoon upgrade\` to grow it.\n-# 💡 The slowest stage is your bottleneck — upgrade that one.`,
        ),
      ),
    ),
  );
}

async function handleUpgrade(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  const lineId = parseLineId(interaction.options.getString("line", true));
  const stage = interaction.options.getString("stage", true) as StageKind;
  if (!lineId) {
    await fail(ctx, "## ❌ Unknown line\nPick one you own.");
    return;
  }
  const def = LINES[lineId];
  const result = await upgrade(ctx, interaction.user.id, lineId, stage);
  if (result.isErr()) {
    await fail(ctx, `## ❌ Upgrade failed\n${result.error.message}`);
    return;
  }
  const { cost, newLevel } = result.unwrap();
  await ctx.respond.send(
    v2Message(
      container(
        "ok",
        text(
          `## 🔧 Upgraded ${def.name}\n**${def.stages[stage].name}** → Level ${newLevel}\nCost: ${coins(cost)}`,
        ),
      ),
    ),
  );
}

async function handleAutomate(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  const lineId = parseLineId(interaction.options.getString("line", true));
  if (!lineId) {
    await fail(ctx, "## ❌ Unknown line\nPick one you own.");
    return;
  }
  const def = LINES[lineId];
  const result = await automate(ctx, interaction.user.id, lineId);
  if (result.isErr()) {
    await fail(ctx, `## ❌ Couldn't automate ${def.name}\n${result.error.message}`);
    return;
  }
  await ctx.respond.send(
    v2Message(
      container(
        "ok",
        text(
          `## 👷 ${def.name} automated\nCost: ${coins(result.unwrap().cost)}\nIt no longer stops at the offline cap — income accrues while you're away.`,
        ),
      ),
    ),
  );
}

async function handleMode(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  const lineId = parseLineId(interaction.options.getString("line", true));
  const mode = interaction.options.getString("mode", true) as "sell" | "stockpile";
  if (!lineId) {
    await fail(ctx, "## ❌ Unknown line\nPick one you own.");
    return;
  }
  const def = LINES[lineId];
  const result = await setMode(ctx, interaction.user.id, lineId, mode);
  if (result.isErr()) {
    await fail(ctx, `## ❌ Couldn't change mode\n${result.error.message}`);
    return;
  }
  const note =
    mode === "sell"
      ? `It now sells **${def.finishedGood.name}** for scrip (all three stages run).`
      : `It now stockpiles **${def.refinedMaterialId}** into your stash (the assembler idles).`;
  await ctx.respond.send(v2Message(container("ok", text(`## 🔁 ${def.name} → ${mode}\n${note}`))));
}

async function handleExchange(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  const amount = interaction.options.getInteger("amount", true);
  const result = await exchange(ctx, interaction.user.id, amount);
  if (result.isErr()) {
    await fail(ctx, `## ❌ Exchange failed\n${result.error.message}`);
    return;
  }
  const { scripSpent, coinsGained } = result.unwrap();
  await ctx.respond.send(
    v2Message(
      container(
        "ok",
        text(
          `## 🏦 Guild Exchange\nConverted ${coins(scripSpent, "scrip")} → ${coins(coinsGained)}\n-# A ${Math.round(EXCHANGE_FEE * 100)}% fee was applied.`,
        ),
      ),
    ),
  );
}

function summaryLine(summary: CollectSummary): string {
  const def = LINES[summary.lineId];
  const reward =
    summary.mode === "sell"
      ? coins(summary.scripGained, "scrip")
      : `${summary.materialsGained}× ${summary.materialId}`;
  const eventNote = summary.event.label ? `  ${summary.event.label}` : "";
  return `**${def.name}** → ${reward}${eventNote}`;
}

async function handleCollect(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
  const userId = interaction.user.id;
  const requested = interaction.options.getString("line");

  let targets: LineId[];
  if (requested) {
    const lineId = parseLineId(requested);
    if (!lineId) {
      await fail(ctx, "## ❌ Unknown line\nPick one you own.");
      return;
    }
    targets = [lineId];
  } else {
    const factory = await ctx.get(userId, UserFactory);
    targets = Object.keys(factory?.lines ?? {}) as LineId[];
  }

  if (targets.length === 0) {
    await fail(ctx, "## 🏭 No production lines yet\nCharter one with `/tycoon charter`.");
    return;
  }

  const collected: CollectSummary[] = [];
  const skipped: string[] = [];
  for (const lineId of targets) {
    const result = await collect(ctx, userId, lineId);
    if (result.isErr()) {
      if (result.error.code !== "NOTHING_TO_COLLECT") {
        skipped.push(`${LINES[lineId].name}: ${result.error.message}`);
      }
    } else {
      collected.push(result.unwrap());
    }
  }

  if (collected.length === 0) {
    const note = skipped.length ? `\n${skipped.join("\n")}` : "";
    await fail(ctx, `## 🏭 Nothing to collect\nYour lines are still producing.${note}`);
    return;
  }

  const totalScrip = collected.reduce((sum, c) => sum + c.scripGained, 0);
  const body = collected.map(summaryLine).join("\n");
  const footer = skipped.length ? `\n\n-# ${skipped.join(" • ")}` : "";
  await ctx.respond.send(
    v2Message(
      container(
        "ok",
        text(`## 📦 Collected`),
        separator("sm"),
        text(
          `${body}\n\n**Total scrip:** ${coins(totalScrip, "scrip")}${footer}\n-# 💡 /tycoon upgrade to clear bottlenecks`,
        ),
      ),
    ),
  );
}

export default defineCommand({
  data,
  help: { hints: ["/tycoon charter", "/tycoon collect", "/tycoon upgrade"] },
  autocomplete,
  execute,
});
