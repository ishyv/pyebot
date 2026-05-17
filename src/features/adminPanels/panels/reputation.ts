import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { ComponentInteraction } from "@/core/feature";
import { updateGuildPaths } from "@/db/repositories/guilds";
import type { Guild as GuildConfig } from "@/db/schemas/guild";
import { channelMention, coreChannelValue, loadGuildConfig } from "../panelHelpers";
import {
  makePanelCustomId,
  type PanelPayload,
  type PanelState,
  panelContainer,
} from "../panelRuntime";

/**
 * Parses a moderator-entered comma-separated keyword list.
 * Exported so tests can call it directly without panel infrastructure.
 */
export function parseReputationKeywords(raw: string): string[] {
  const seen = new Set<string>();
  const keywords = raw
    .split(",")
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length > 0)
    .filter((keyword) => {
      const key = keyword.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  if (keywords.length > 25) {
    throw new Error("Use 25 or fewer reputation keywords.");
  }

  const tooLong = keywords.find((keyword) => keyword.length > 64);
  if (tooLong) {
    throw new Error(
      `Reputation keyword "${tooLong.slice(0, 20)}" is too long; use 64 characters or fewer.`,
    );
  }

  return keywords;
}

/** Renders detection toggle, request channel, and keyword list. */
export function render(session: PanelState, cfg: GuildConfig): PanelPayload {
  return {
    container: panelContainer({
      title: "Reputation Panel",
      fields: [
        {
          name: "Detection",
          value: cfg.reputation.detectionEnabled ? "Enabled" : "Disabled",
          inline: true,
        },
        {
          name: "Request channel",
          value: channelMention(
            cfg.reputation.requestChannelId ?? coreChannelValue(cfg, "repRequests"),
          ),
          inline: true,
        },
        {
          name: "Keywords",
          value: cfg.reputation.keywords.length ? cfg.reputation.keywords.join(", ") : "None",
        },
      ],
    }),
    actionRows: [
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId(makePanelCustomId(session, "reputation", "channel"))
          .setPlaceholder("Set reputation request channel")
          .setMinValues(1)
          .setMaxValues(1),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "reputation", "toggle"))
          .setLabel("Toggle detection")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "reputation", "keywords-modal"))
          .setLabel("Set keywords")
          .setStyle(ButtonStyle.Primary),
      ),
    ],
  };
}

/** Handles toggle, channel pick, and keyword modal for reputation. */
export async function action(
  interaction: ComponentInteraction,
  session: PanelState,
  actionStr: string,
): Promise<boolean> {
  const cfg = await loadGuildConfig(session.guildId);
  if (actionStr === "toggle")
    await updateGuildPaths(
      session.guildId,
      { "reputation.detectionEnabled": !cfg.reputation.detectionEnabled },
      { upsert: true },
    );
  if (interaction.isChannelSelectMenu() && actionStr === "channel")
    await updateGuildPaths(
      session.guildId,
      {
        "reputation.requestChannelId": interaction.values[0],
        "channels.core.repRequests": { channelId: interaction.values[0] },
      },
      { upsert: true },
    );
  if (actionStr === "keywords-modal" && interaction.isButton()) {
    const modal = new ModalBuilder()
      .setCustomId(makePanelCustomId(session, "reputation", "keywords-submit"))
      .setTitle("Reputation keywords")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("keywords")
            .setLabel("Comma-separated keywords")
            .setPlaceholder("thanks, +rep, good trade")
            .setRequired(false)
            .setStyle(TextInputStyle.Paragraph),
        ),
      );
    await interaction.showModal(modal);
    return false;
  }
  if (actionStr === "keywords-submit" && interaction.isModalSubmit()) {
    const keywords = parseReputationKeywords(interaction.fields.getTextInputValue("keywords"));
    const result = await updateGuildPaths(
      session.guildId,
      { "reputation.keywords": keywords },
      { upsert: true },
    );
    if (result.isErr()) throw result.error;
  }
  return true;
}
