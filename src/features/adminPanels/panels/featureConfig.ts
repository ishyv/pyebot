import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import type { ComponentInteraction } from "@/core/feature";
import type { FeatureCatalogEntry } from "@/core/featureCatalog";
import { listConfigurableFeatures } from "@/core/featureCatalog";
import {
  buildConfigFieldPatch,
  type FeatureConfigField,
  getConfigPathValue,
} from "@/core/featureConfig";
import { updateGuildPaths } from "@/db/repositories/guilds";
import type { Guild as GuildConfig } from "@/db/schemas/guild";
import { channelMention, limitText, loadGuildConfig, modalInput } from "../panelHelpers";
import {
  makePanelCustomId,
  type PanelActionRow,
  type PanelPayload,
  type PanelState,
  panelContainer,
} from "../panelRuntime";

function selectModule(
  features: readonly FeatureCatalogEntry[],
  selectedId: string | undefined,
): FeatureCatalogEntry | undefined {
  return features.find((f) => f.id === selectedId) ?? features[0];
}

function selectField(
  fields: readonly FeatureConfigField[],
  selectedKey: string | undefined,
): FeatureConfigField | undefined {
  return fields.find((f) => f.key === selectedKey) ?? fields[0];
}

function emptyField(): FeatureConfigField {
  return { kind: "string", key: "none", label: "No fields", path: "none", required: false };
}

function emptyEntry(): FeatureCatalogEntry {
  return {
    id: "none",
    name: "No configurable features",
    description: "No configurable features are currently loaded.",
    defaultEnabled: false,
  };
}

function formatValue(field: FeatureConfigField, value: unknown): string {
  if (value === null || value === undefined || value === "")
    return field.required ? "Not set (required)" : "Not set";
  if (field.kind === "channel" && typeof value === "string") return channelMention(value);
  if (field.kind === "boolean" && typeof value === "boolean") return value ? "Enabled" : "Disabled";
  return limitText(value, 900);
}

function fieldControls(session: PanelState, field: FeatureConfigField): PanelActionRow[] {
  if (field.kind === "channel") {
    const channelSelect = new ChannelSelectMenuBuilder()
      .setCustomId(makePanelCustomId(session, "feature-config", "set-channel"))
      .setPlaceholder(`Set ${field.label}`)
      .setMinValues(1)
      .setMaxValues(1);
    channelSelect.addChannelTypes(...field.channelTypes);
    return [
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "feature-config", "clear-field"))
          .setLabel("Clear")
          .setStyle(ButtonStyle.Danger),
      ),
    ];
  }
  if (field.kind === "boolean") {
    return [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "feature-config", "toggle-boolean"))
          .setLabel("Toggle")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "feature-config", "clear-field"))
          .setLabel("Clear")
          .setStyle(ButtonStyle.Danger),
      ),
    ];
  }
  if (field.kind === "select") {
    const select = new StringSelectMenuBuilder()
      .setCustomId(makePanelCustomId(session, "feature-config", "select-option"))
      .setPlaceholder(`Set ${field.label}`)
      .addOptions(
        field.options
          .slice(0, 25)
          .map((option) =>
            new StringSelectMenuOptionBuilder().setLabel(option.label).setValue(option.value),
          ),
      );
    return [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "feature-config", "clear-field"))
          .setLabel("Clear")
          .setStyle(ButtonStyle.Danger),
      ),
    ];
  }
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(makePanelCustomId(session, "feature-config", "value-modal"))
        .setLabel("Set value")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(makePanelCustomId(session, "feature-config", "clear-field"))
        .setLabel("Clear")
        .setStyle(ButtonStyle.Danger),
    ),
  ];
}

async function writeField(
  guildId: string,
  feature: FeatureCatalogEntry,
  field: FeatureConfigField,
  value: unknown,
): Promise<void> {
  if (!feature.config) throw new Error("Feature has no config definition.");
  const patch = buildConfigFieldPatch(feature.config, field.key, value);
  if (patch.isErr()) throw new Error(patch.error.message);
  await updateGuildPaths(guildId, patch.unwrap(), { upsert: true });
}

function coerceValue(field: FeatureConfigField, value: string): unknown {
  if (field.kind === "number") {
    const n = Number(value);
    if (!Number.isFinite(n)) throw new Error(`${field.label} must be numeric.`);
    return field.integer ? Math.trunc(n) : n;
  }
  return value;
}

/**
 * Renders feature config field selectors and the appropriate control row.
 * Exported for command-level use (feature-config command delegates here).
 */
export function render(
  session: PanelState,
  cfg: GuildConfig,
  features: readonly FeatureCatalogEntry[] = listConfigurableFeatures(),
): PanelPayload {
  const configurable = features.filter((f) => f.config);
  const selectedFeature = selectModule(configurable, session.selectedFeatureConfigId);
  const fields = selectedFeature?.config ? Object.values(selectedFeature.config.fields) : [];
  const selectedField = selectField(fields, session.selectedFeatureConfigField);
  const featureSelect = new StringSelectMenuBuilder()
    .setCustomId(makePanelCustomId(session, "feature-config", "feature"))
    .setPlaceholder("Choose feature")
    .setDisabled(configurable.length === 0)
    .addOptions(
      (configurable.length ? configurable : [emptyEntry()]).slice(0, 25).map((f) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(f.id)
          .setDescription(
            f.config
              ? `${Object.keys(f.config.fields).length} configurable field(s)`
              : "No configurable features",
          )
          .setValue(f.id)
          .setDefault(f.id === selectedFeature?.id),
      ),
    );
  const fieldSelect = new StringSelectMenuBuilder()
    .setCustomId(makePanelCustomId(session, "feature-config", "field"))
    .setPlaceholder("Choose config field")
    .setDisabled(fields.length === 0)
    .addOptions(
      (fields.length ? fields : [emptyField()]).slice(0, 25).map((f) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(f.label)
          .setDescription(f.description ?? f.path)
          .setValue(f.key)
          .setDefault(f.key === selectedField?.key),
      ),
    );
  const components: PanelActionRow[] = [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(featureSelect),
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(fieldSelect),
  ];
  if (selectedField) components.push(...fieldControls(session, selectedField));
  return {
    container: panelContainer({
      title: "Feature Config Panel",
      description: selectedFeature
        ? `Selected feature: **${selectedFeature.id}**\nSelected field: **${selectedField?.label ?? "none"}**`
        : "No configurable features are currently loaded.",
      fields: fields.length
        ? fields.map((f) => ({
            name: f.label,
            value: `${formatValue(f, getConfigPathValue(cfg, f.path))}\nPath: \`${f.path}\``,
            inline: true,
          }))
        : [{ name: "Fields", value: "No declared config fields.", inline: false }],
    }),
    actionRows: components,
  };
}

/**
 * Handles feature/field selection and all config write actions.
 * Exported for command-level use.
 */
export async function action(
  interaction: ComponentInteraction,
  session: PanelState,
  actionStr: string,
  features: readonly FeatureCatalogEntry[] = listConfigurableFeatures(),
): Promise<boolean> {
  const configurable = features.filter((f) => f.config);
  if (interaction.isStringSelectMenu() && actionStr === "feature") {
    session.selectedFeatureConfigId = interaction.values[0];
    session.selectedFeatureConfigField = undefined;
    return true;
  }
  if (interaction.isStringSelectMenu() && actionStr === "field") {
    session.selectedFeatureConfigField = interaction.values[0];
    return true;
  }
  const cfg = await loadGuildConfig(session.guildId);
  const feature = selectModule(configurable, session.selectedFeatureConfigId);
  if (!feature?.config) throw new Error("Choose a configurable feature first.");
  const field = selectField(
    Object.values(feature.config.fields),
    session.selectedFeatureConfigField,
  );
  if (!field) throw new Error("Choose a config field first.");
  if (interaction.isChannelSelectMenu() && actionStr === "set-channel") {
    await writeField(session.guildId, feature, field, interaction.values[0]);
    return true;
  }
  if (interaction.isStringSelectMenu() && actionStr === "select-option") {
    await writeField(session.guildId, feature, field, interaction.values[0]);
    return true;
  }
  if (actionStr === "toggle-boolean") {
    const current = Boolean(getConfigPathValue(cfg, field.path));
    await writeField(session.guildId, feature, field, !current);
    return true;
  }
  if (actionStr === "clear-field") {
    await writeField(session.guildId, feature, field, null);
    return true;
  }
  if (actionStr === "value-modal" && interaction.isButton()) {
    const modal = new ModalBuilder()
      .setCustomId(makePanelCustomId(session, "feature-config", "value-submit"))
      .setTitle(`Set ${field.label}`)
      .addComponents(
        modalInput(
          "value",
          field.label,
          String(getConfigPathValue(cfg, field.path) ?? ""),
          field.required,
        ),
      );
    await interaction.showModal(modal);
    return false;
  }
  if (actionStr === "value-submit" && interaction.isModalSubmit()) {
    const value = coerceValue(field, interaction.fields.getTextInputValue("value"));
    await writeField(session.guildId, feature, field, value);
  }
  return true;
}
