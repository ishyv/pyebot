import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import { resolveFeatureEnabled } from "@/components/guild-features";
import type { ComponentInteraction } from "@/core/feature";
import { listFeatureCatalog } from "@/core/featureCatalog";
import type { Guild as GuildConfig } from "@/db/schemas/guild";
import { setFeatureSettings, toggleFeatureSetting } from "../configMutations";
import { loadGuildFeatures, yesNo } from "../panelHelpers";
import {
  makePanelCustomId,
  type PanelPayload,
  type PanelState,
  panelContainer,
} from "../panelRuntime";

/** Renders all guild features with current enabled/disabled state. */
export async function render(session: PanelState, _cfg: GuildConfig): Promise<PanelPayload> {
  const featureState = await loadGuildFeatures(session.guildId);
  const features = listFeatureCatalog();
  const featureSelect = new StringSelectMenuBuilder()
    .setCustomId(makePanelCustomId(session, "features", "toggle-one"))
    .setPlaceholder("Toggle a feature")
    .addOptions(
      features.map((feature) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(feature.name)
          .setDescription(
            resolveFeatureEnabled(feature, featureState.overrides)
              ? "Currently enabled"
              : "Currently disabled",
          )
          .setValue(feature.id),
      ),
    );
  return {
    container: panelContainer({
      title: "Features Panel",
      fields: features.map((feature) => ({
        name: feature.name,
        value: yesNo(resolveFeatureEnabled(feature, featureState.overrides)),
        inline: true,
      })),
    }),
    actionRows: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(featureSelect),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "features", "enable-all"))
          .setLabel("Enable all")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(makePanelCustomId(session, "features", "disable-all"))
          .setLabel("Disable all")
          .setStyle(ButtonStyle.Danger),
      ),
    ],
  };
}

/** Handles single toggle and bulk enable/disable. */
export async function action(
  interaction: ComponentInteraction,
  session: PanelState,
  actionStr: string,
): Promise<boolean> {
  const features = listFeatureCatalog();
  const byId = new Map(features.map((feature) => [feature.id, feature]));
  if (interaction.isStringSelectMenu() && actionStr === "toggle-one") {
    const featureId = interaction.values[0];
    const feature = byId.get(featureId);
    if (!feature) throw new Error(`Unknown feature: ${featureId}`);
    const featureState = await loadGuildFeatures(session.guildId);
    const current = resolveFeatureEnabled(feature, featureState.overrides);
    const result = await toggleFeatureSetting(session.guildId, feature.id, !current);
    if (result.isErr()) throw result.error;
    return true;
  }
  if (actionStr === "enable-all" || actionStr === "disable-all") {
    const enabled = actionStr === "enable-all";
    const result = await setFeatureSettings(
      session.guildId,
      Object.fromEntries(features.map((feature) => [feature.id, enabled])),
    );
    if (result.isErr()) throw result.error;
  }
  return true;
}
