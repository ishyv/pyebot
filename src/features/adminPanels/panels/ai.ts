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
import { aiConfig } from "@/features/ai/config";
import { applyGuildConfigPaths } from "../configMutations";
import { modalInput } from "../panelHelpers";
import {
  makePanelCustomId,
  type PanelPayload,
  type PanelState,
  panelContainer,
} from "../panelRuntime";

/** Renders AI provider, model, and rate-limit summary. */
export function render(session: PanelState, cfg: GuildConfig): PanelPayload {
  const models = [
    ...Object.values(aiConfig.providers.openai),
    ...Object.values(aiConfig.providers.google),
  ].slice(0, 25);
  return {
    container: panelContainer({
      title: "AI Panel",
      fields: [
        { name: "Provider", value: cfg.ai.provider, inline: true },
        { name: "Model", value: `\`${cfg.ai.model}\``, inline: true },
        {
          name: "Rate limits",
          value: `${cfg.ai.rateLimit.perUserPerMinute}/user/min\n${cfg.ai.rateLimit.perGuildPerMinute}/guild/min`,
          inline: true,
        },
      ],
    }),
    actionRows: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(makePanelCustomId(session, "ai", "provider"))
          .setPlaceholder("Set provider")
          .addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel("Gemini")
              .setValue("gemini")
              .setDefault(cfg.ai.provider === "gemini"),
            new StringSelectMenuOptionBuilder()
              .setLabel("OpenAI")
              .setValue("openai")
              .setDefault(cfg.ai.provider === "openai"),
          ),
      ),
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(makePanelCustomId(session, "ai", "model"))
          .setPlaceholder("Set model")
          .addOptions(
            models.map((model) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(model)
                .setValue(model)
                .setDefault(cfg.ai.model === model),
            ),
          ),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "ai", "rate-modal"))
          .setLabel("Set rate limits")
          .setStyle(ButtonStyle.Primary),
      ),
    ],
  };
}

/** Handles provider/model selection and rate-limit modal for the AI panel. */
export async function action(
  interaction: ComponentInteraction,
  session: PanelState,
  actionStr: string,
): Promise<boolean> {
  if (interaction.isStringSelectMenu() && actionStr === "provider") {
    const provider = interaction.values[0];
    const defaultModel =
      provider === "openai" ? aiConfig.providers.openai.low : aiConfig.providers.google.low;
    await applyGuildConfigPaths(
      session.guildId,
      { "ai.provider": provider, "ai.model": defaultModel },
      { upsert: true },
    );
    return true;
  }
  if (interaction.isStringSelectMenu() && actionStr === "model") {
    await applyGuildConfigPaths(
      session.guildId,
      { "ai.model": interaction.values[0] },
      { upsert: true },
    );
    return true;
  }
  if (actionStr === "rate-modal" && interaction.isButton()) {
    const modal = new ModalBuilder()
      .setCustomId(makePanelCustomId(session, "ai", "rate-submit"))
      .setTitle("AI rate limits")
      .addComponents(
        modalInput("user", "Per user per minute", "8", true),
        modalInput("guild", "Per guild per minute", "60", true),
      );
    await interaction.showModal(modal);
    return false;
  }
  if (actionStr === "rate-submit" && interaction.isModalSubmit()) {
    const perUser = Number(interaction.fields.getTextInputValue("user"));
    const perGuild = Number(interaction.fields.getTextInputValue("guild"));
    if (!Number.isInteger(perUser) || perUser < 0 || !Number.isInteger(perGuild) || perGuild < 0)
      throw new Error("Rate limits must be whole numbers.");
    await applyGuildConfigPaths(
      session.guildId,
      { "ai.rateLimit.perUserPerMinute": perUser, "ai.rateLimit.perGuildPerMinute": perGuild },
      { upsert: true },
    );
  }
  return true;
}
