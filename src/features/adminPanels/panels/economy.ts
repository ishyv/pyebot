import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import type { ComponentInteraction } from "@/core/feature";
import type { Guild as GuildConfig } from "@/db/schemas/guild";
import {
  applyGuildConfigPaths,
  loadEconomySettings,
  saveEconomySettings,
  saveEconomyTaxSettings,
} from "../configMutations";
import { loadGuildConfig, modalInput, yesNo } from "../panelHelpers";
import {
  makePanelCustomId,
  type PanelPayload,
  type PanelState,
  panelContainer,
} from "../panelRuntime";

/** Renders daily, work, tax, sectors, and feature-flag summary. */
export async function render(session: PanelState, cfg: GuildConfig): Promise<PanelPayload> {
  const economyResult = await loadEconomySettings(session.guildId);
  const economy = economyResult.isOk() ? economyResult.unwrap() : cfg.economy;
  const features = cfg.economy.features;
  return {
    container: panelContainer({
      title: "Economy Panel",
      fields: [
        {
          name: "Daily",
          value: `${economy.daily.dailyReward} ${economy.daily.dailyCurrencyId}\nCooldown ${economy.daily.dailyCooldownHours}h\nFee ${(economy.daily.dailyFeeRate * 100).toFixed(2)}%`,
          inline: true,
        },
        {
          name: "Work",
          value: `Base ${economy.work.workBaseMintReward}\nBonus max ${economy.work.workBonusFromWorksMax}\nCooldown ${economy.work.workCooldownMinutes}m\nCap ${economy.work.workDailyCap}`,
          inline: true,
        },
        {
          name: "Tax",
          value: `${yesNo(cfg.economy.tax.enabled)}\nRate ${(cfg.economy.tax.rate * 100).toFixed(1)}%\nMin ${cfg.economy.tax.minimumTaxableAmount}`,
          inline: true,
        },
        {
          name: "Sectors",
          value:
            Object.entries(economy.sectors ?? {})
              .map(([name, value]) => `${name}: ${value}`)
              .join("\n") || "None",
          inline: true,
        },
        {
          name: "Features",
          value: Object.entries(features)
            .map(([name, enabled]) => `${name}: ${yesNo(enabled)}`)
            .join("\n"),
          inline: true,
        },
      ],
    }),
    actionRows: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(makePanelCustomId(session, "economy", "feature-toggle"))
          .setPlaceholder("Toggle economy feature")
          .addOptions(
            Object.entries(features).map(([name, enabled]) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(name)
                .setDescription(enabled ? "Enabled" : "Disabled")
                .setValue(name),
            ),
          ),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "economy", "daily-modal"))
          .setLabel("Daily config")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "economy", "work-modal"))
          .setLabel("Work config")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "economy", "tax-modal"))
          .setLabel("Tax config")
          .setStyle(ButtonStyle.Primary),
      ),
    ],
  };
}

/** Handles economy feature toggle and the three config modals. */
export async function action(
  interaction: ComponentInteraction,
  session: PanelState,
  actionStr: string,
): Promise<boolean> {
  const cfg = await loadGuildConfig(session.guildId);
  const economyResult = await loadEconomySettings(session.guildId);
  const economy = economyResult.isOk() ? economyResult.unwrap() : cfg.economy;
  if (interaction.isStringSelectMenu() && actionStr === "feature-toggle") {
    const feature = interaction.values[0];
    const current = Boolean((cfg.economy.features as Record<string, boolean>)[feature]);
    await applyGuildConfigPaths(
      session.guildId,
      { [`economy.features.${feature}`]: !current },
      { upsert: true },
    );
    return true;
  }
  if (actionStr.endsWith("-modal") && interaction.isButton()) {
    const kind = actionStr.replace("-modal", "");
    const labels =
      kind === "daily"
        ? ["Daily reward", "Cooldown hours", "Fee rate"]
        : kind === "work"
          ? ["Base reward", "Works bonus max", "Daily cap"]
          : ["Tax rate", "Minimum taxable amount", "Enabled (1 or 0)"];
    const modal = new ModalBuilder()
      .setCustomId(makePanelCustomId(session, "economy", `${kind}-submit`))
      .setTitle("Economy config")
      .addComponents(
        modalInput("a", labels[0], "0", true),
        modalInput("b", labels[1], "0", false),
        modalInput("c", labels[2], "0", false),
      );
    await interaction.showModal(modal);
    return false;
  }
  if (interaction.isModalSubmit()) {
    const a = Number(interaction.fields.getTextInputValue("a"));
    const b = Number(interaction.fields.getTextInputValue("b") || "0");
    const c = Number(interaction.fields.getTextInputValue("c") || "0");
    if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c))
      throw new Error("Economy values must be numeric.");
    if (actionStr === "daily-submit")
      await saveEconomySettings(session.guildId, {
        daily: {
          dailyReward: Math.trunc(a),
          dailyCooldownHours: Math.trunc(b || economy.daily.dailyCooldownHours),
          dailyFeeRate: c || economy.daily.dailyFeeRate,
        },
      });
    if (actionStr === "work-submit")
      await saveEconomySettings(session.guildId, {
        work: {
          workBaseMintReward: Math.trunc(a),
          workBonusFromWorksMax: Math.trunc(b),
          workDailyCap: Math.trunc(c || economy.work.workDailyCap),
        },
      });
    if (actionStr === "tax-submit")
      await saveEconomyTaxSettings(session.guildId, {
        rate: a,
        minimumTaxableAmount: Math.trunc(b),
        enabled: c > 0,
      });
  }
  return true;
}
