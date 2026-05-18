import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
} from "discord.js";
import type { ComponentInteraction } from "@/core/feature";
import type { Guild as GuildConfig } from "@/db/schemas/guild";
import { applyGuildConfigPaths } from "../configMutations";
import { loadGuildConfig, yesNo } from "../panelHelpers";
import {
  makePanelCustomId,
  type PanelPayload,
  type PanelState,
  panelContainer,
} from "../panelRuntime";

/** Renders the forum auto-reply configuration. */
export function render(session: PanelState, cfg: GuildConfig): PanelPayload {
  return {
    container: panelContainer({
      title: "Forums Panel",
      fields: [
        { name: "Auto-reply", value: yesNo(cfg.forumAutoReply.enabled), inline: true },
        {
          name: "Forums",
          value: cfg.forumAutoReply.forumIds.length
            ? cfg.forumAutoReply.forumIds.map((id) => `<#${id}>`).join("\n")
            : "None",
        },
      ],
    }),
    actionRows: [
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId(makePanelCustomId(session, "forums", "channels"))
          .setPlaceholder("Set forum auto-reply channels")
          .addChannelTypes(ChannelType.GuildForum)
          .setMinValues(1)
          .setMaxValues(10),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "forums", "toggle"))
          .setLabel("Toggle auto-reply")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "forums", "clear"))
          .setLabel("Clear forums")
          .setStyle(ButtonStyle.Danger),
      ),
    ],
  };
}

/** Handles forum channel selection, toggle, and clear. */
export async function action(
  interaction: ComponentInteraction,
  session: PanelState,
  actionStr: string,
): Promise<boolean> {
  const cfg = await loadGuildConfig(session.guildId);
  if (actionStr === "toggle")
    await applyGuildConfigPaths(
      session.guildId,
      { "forumAutoReply.enabled": !cfg.forumAutoReply.enabled },
      { upsert: true },
    );
  if (actionStr === "clear")
    await applyGuildConfigPaths(
      session.guildId,
      { "forumAutoReply.forumIds": [] },
      { upsert: true },
    );
  if (interaction.isChannelSelectMenu() && actionStr === "channels")
    await applyGuildConfigPaths(
      session.guildId,
      { "forumAutoReply.forumIds": interaction.values, "forumAutoReply.enabled": true },
      { upsert: true },
    );
  return true;
}
