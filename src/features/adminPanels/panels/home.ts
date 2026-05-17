import { resolveFeatureEnabled } from "@/components/guild-features";
import type { ComponentInteraction } from "@/core/feature";
import { listFeatureCatalog } from "@/core/featureCatalog";
import type { Guild as GuildConfig } from "@/db/schemas/guild";
import { CORE_CHANNEL_DEFINITIONS, loadGuildFeatures, roleMention, yesNo } from "../panelHelpers";
import { type PanelPayload, type PanelState, panelContainer } from "../panelRuntime";

/** Renders the server-wide status overview. */
export async function render(session: PanelState, cfg: GuildConfig): Promise<PanelPayload> {
  const featureState = await loadGuildFeatures(session.guildId);
  const features = listFeatureCatalog();
  const enabled = features.filter((feature) =>
    resolveFeatureEnabled(feature, featureState.overrides),
  ).length;
  return {
    container: panelContainer({
      title: "Admin Dashboard",
      description: "Choose a panel below. All controls in this session are private to you.",
      fields: [
        {
          name: "Features",
          value: `${enabled}/${features.length} enabled`,
          inline: true,
        },
        {
          name: "Core channels",
          value: `${Object.values(cfg.channels.core).filter(Boolean).length}/${Object.keys(CORE_CHANNEL_DEFINITIONS).length} set`,
          inline: true,
        },
        { name: "Managed roles", value: String(Object.keys(cfg.roles).length), inline: true },
        {
          name: "Moderation",
          value: `Alt detection: ${yesNo(cfg.moderation.altDetectionEnabled)}\nEscalation: ${yesNo(cfg.moderation.escalation.enabled)}`,
          inline: true,
        },
        {
          name: "Automod",
          value: `Link spam: ${yesNo(cfg.automod.linkSpam.enabled)}\nRaid: ${yesNo(cfg.automod.raidDetection.enabled)}`,
          inline: true,
        },
        {
          name: "New users",
          value: `${yesNo(cfg.automod.tempRolePolicies.recentlyJoined.enabled)}\nRole: ${roleMention(cfg.automod.tempRolePolicies.recentlyJoined.roleId)}`,
          inline: true,
        },
        {
          name: "Economy",
          value: `Daily ${cfg.economy.daily.dailyReward} ${cfg.economy.daily.dailyCurrencyId}\nWork cap ${cfg.economy.work.workDailyCap}/day`,
          inline: true,
        },
      ],
      footer: "Ephemeral admin session expires after 5 minutes of inactivity.",
    }),
    actionRows: [],
  };
}

/** Home panel has no interactive controls; nav handles all navigation. */
export async function action(
  _interaction: ComponentInteraction,
  _session: PanelState,
  _action: string,
): Promise<boolean> {
  return true;
}
