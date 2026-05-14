/**
 * `/features` panel — the framework's auto-generated admin command for
 * viewing and toggling features per-guild.
 *
 * This file builds:
 *
 *   1. A SlashCommandBuilder for `/features` with three sub-commands:
 *        - `/features` (alias `panel`) — render the embed + buttons.
 *        - `/features enable  <id>`    — power-user one-liner.
 *        - `/features disable <id>`    — same, for disabling.
 *      All require ManageGuild permission.
 *
 *   2. A handler set for the panel buttons, whose custom ids look like:
 *        features:toggle:<feature-id>
 *      The bootstrap registers these via the ComponentRouter.
 *
 * The list of features is captured at boot — features cannot be hot-added
 * without restarting the bot — so the sub-command choices are baked in
 * when `buildFeaturesCommand` runs.
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import { GuildFeatures } from "@/components/guild-features";
import { isAdmin, isFeatureEnabled } from "./middleware";
import type { CommandModule, Ctx, FeatureDescriptor } from "./types";

const PANEL_NAME = "features";
const TOGGLE_PREFIX = "features:toggle:";

/** Encode "toggle this feature" into a button customId. */
function toggleId(featureId: string): string {
  return `${TOGGLE_PREFIX}${featureId}`;
}

/** Build the SlashCommandBuilder for `/features` with sub-commands derived from loaded features. */
function buildSlashCommand(features: ReadonlyArray<FeatureDescriptor>): SlashCommandBuilder {
  const choices = features.map((f) => ({ name: f.name, value: f.id }));
  return new SlashCommandBuilder()
    .setName(PANEL_NAME)
    .setDescription("Manage which features are enabled in this server.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.toString())
    .addSubcommand((s) => s.setName("panel").setDescription("Show the feature toggle panel."))
    .addSubcommand((s) =>
      s
        .setName("enable")
        .setDescription("Enable a feature in this server.")
        .addStringOption((o) =>
          o.setName("feature").setDescription("The feature to enable.").setRequired(true).addChoices(...choices),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("disable")
        .setDescription("Disable a feature in this server.")
        .addStringOption((o) =>
          o.setName("feature").setDescription("The feature to disable.").setRequired(true).addChoices(...choices),
        ),
    ) as SlashCommandBuilder;
}

/** Render the embed listing every feature and its current state in this guild. */
async function renderEmbed(
  ctx: Ctx,
  guildId: string,
  features: ReadonlyArray<FeatureDescriptor>,
): Promise<{ embed: EmbedBuilder; rows: ActionRowBuilder<ButtonBuilder>[] }> {
  const embed = new EmbedBuilder()
    .setTitle("⚙ Server Features")
    .setDescription("Toggle features on or off. Changes apply immediately.");

  const lines: string[] = [];
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  let currentRow = new ActionRowBuilder<ButtonBuilder>();

  for (const f of features) {
    const enabled = await isFeatureEnabled(ctx, guildId, f);
    const icon = enabled ? "🟢" : "🔴";
    lines.push(`${icon} **${f.name}** — ${f.description}`);

    const button = new ButtonBuilder()
      .setCustomId(toggleId(f.id))
      .setLabel(enabled ? `Disable ${f.name}` : `Enable ${f.name}`)
      .setStyle(enabled ? ButtonStyle.Danger : ButtonStyle.Success);

    if (currentRow.components.length >= 5) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder<ButtonBuilder>();
    }
    currentRow.addComponents(button);
  }

  if (currentRow.components.length > 0) rows.push(currentRow);
  embed.setDescription(lines.join("\n"));
  return { embed, rows };
}

/**
 * Build the entire `/features` CommandModule. Captures the loaded features
 * by closure so the slash data is correct on first registration.
 */
export function buildFeaturesCommand(features: ReadonlyArray<FeatureDescriptor>): CommandModule {
  const data = buildSlashCommand(features);
  const byId = new Map(features.map((f) => [f.id, f]));

  async function execute(interaction: ChatInputCommandInteraction, ctx: Ctx): Promise<void> {
    if (!isAdmin(interaction)) {
      await interaction.reply({ content: "You need Manage Server permission.", ephemeral: true });
      return;
    }
    const sub = interaction.options.getSubcommand(false);
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({ content: "This command must be used in a server.", ephemeral: true });
      return;
    }

    if (sub === "enable" || sub === "disable") {
      const id = interaction.options.getString("feature", true);
      if (!byId.has(id)) {
        await interaction.reply({ content: `Unknown feature: ${id}`, ephemeral: true });
        return;
      }
      await ctx.patch(guildId, GuildFeatures, (cur) => ({
        overrides: { ...cur.overrides, [id]: sub === "enable" },
      }));
      const feat = byId.get(id);
      await interaction.reply({
        content: `${sub === "enable" ? "Enabled" : "Disabled"} **${feat?.name ?? id}** in this server.`,
        ephemeral: true,
      });
      return;
    }

    // Default = panel
    const { embed, rows } = await renderEmbed(ctx, guildId, features);
    await interaction.reply({ embeds: [embed], components: rows, ephemeral: true });
  }

  return { data, execute };
}

/**
 * Handler for `features:toggle:<id>` buttons. Registered in the
 * ComponentRouter by bootstrap (not via @Handle, since this is framework
 * code, not a feature).
 */
export function buildToggleHandler(features: ReadonlyArray<FeatureDescriptor>) {
  const byId = new Map(features.map((f) => [f.id, f]));
  return async (interaction: ButtonInteraction, ctx: Ctx): Promise<void> => {
    if (!interaction.guildId) {
      await interaction.reply({ content: "Use in a server.", ephemeral: true });
      return;
    }
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: "You need Manage Server permission.", ephemeral: true });
      return;
    }
    const id = interaction.customId.slice(TOGGLE_PREFIX.length);
    const feat = byId.get(id);
    if (!feat) {
      await interaction.reply({ content: `Unknown feature: ${id}`, ephemeral: true });
      return;
    }
    const current = await isFeatureEnabled(ctx, interaction.guildId, feat);
    await ctx.patch(interaction.guildId, GuildFeatures, (cur) => ({
      overrides: { ...cur.overrides, [id]: !current },
    }));
    const { embed, rows } = await renderEmbed(ctx, interaction.guildId, features);
    await interaction.update({ embeds: [embed], components: rows });
  };
}

export const TOGGLE_CUSTOM_ID_PREFIX = TOGGLE_PREFIX;
export const FEATURES_COMMAND_NAME = PANEL_NAME;
