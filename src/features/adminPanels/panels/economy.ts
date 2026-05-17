import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import type { ComponentInteraction } from "@/core/feature";
import { updateGuildPaths } from "@/db/repositories/guilds";
import type { Guild as GuildConfig } from "@/db/schemas/guild";
import { loadGuildConfig, modalInput, yesNo } from "../panelHelpers";
import {
  makePanelCustomId,
  type PanelPayload,
  type PanelState,
  panelContainer,
} from "../panelRuntime";

/** Renders daily, work, tax, sectors, and feature-flag summary. */
export function render(session: PanelState, cfg: GuildConfig): PanelPayload {
  const features = cfg.economy.features;
  return {
    container: panelContainer({
      title: "Economy Panel",
      fields: [
        {
          name: "Daily",
          value: `${cfg.economy.daily.dailyReward} ${cfg.economy.daily.dailyCurrencyId}\nCooldown ${cfg.economy.daily.dailyCooldownHours}h\nFee ${(cfg.economy.daily.dailyFeeRate * 100).toFixed(2)}%`,
          inline: true,
        },
        {
          name: "Work",
          value: `Base ${cfg.economy.work.workBaseMintReward}\nBonus max ${cfg.economy.work.workBonusFromWorksMax}\nCooldown ${cfg.economy.work.workCooldownMinutes}m\nCap ${cfg.economy.work.workDailyCap}`,
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
            Object.entries(cfg.economy.sectors ?? {})
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
  if (interaction.isStringSelectMenu() && actionStr === "feature-toggle") {
    const feature = interaction.values[0];
    const current = Boolean((cfg.economy.features as Record<string, boolean>)[feature]);
    await updateGuildPaths(
      session.guildId,
      { [`economy.features.${feature}`]: !current },
      { upsert: true },
    );
    return true;
  }
  if (actionStr.endsWith("-modal") && interaction.isButton()) {
    const modal = new ModalBuilder()
      .setCustomId(
        makePanelCustomId(session, "economy", `${actionStr.replace("-modal", "")}-submit`),
      )
      .setTitle("Economy config")
      .addComponents(
        modalInput("a", "Value A", "0", true),
        modalInput("b", "Value B", "0", false),
        modalInput("c", "Value C", "0", false),
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
      await updateGuildPaths(
        session.guildId,
        {
          "economy.daily.dailyReward": Math.trunc(a),
          "economy.daily.dailyCooldownHours": Math.trunc(b || cfg.economy.daily.dailyCooldownHours),
          "economy.daily.dailyFeeRate": c || cfg.economy.daily.dailyFeeRate,
        },
        { upsert: true },
      );
    if (actionStr === "work-submit")
      await updateGuildPaths(
        session.guildId,
        {
          "economy.work.workBaseMintReward": Math.trunc(a),
          "economy.work.workBonusFromWorksMax": Math.trunc(b),
          "economy.work.workDailyCap": Math.trunc(c || cfg.economy.work.workDailyCap),
        },
        { upsert: true },
      );
    if (actionStr === "tax-submit")
      await updateGuildPaths(
        session.guildId,
        {
          "economy.tax.rate": a,
          "economy.tax.minimumTaxableAmount": Math.trunc(b),
          "economy.tax.enabled": c > 0,
        },
        { upsert: true },
      );
  }
  return true;
}
