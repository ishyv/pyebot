import type { FeatureModule, ComponentInteraction } from "@/core/feature";
import { PANEL_PREFIX } from "./panelRuntime";
import { handlePanelInteraction } from "./panels";
import * as dashboardCmd from "./commands/dashboard";
import * as channelsCmd from "./commands/channels";
import * as featuresCmd from "./commands/features";
import * as rolesCmd from "./commands/roles";
import * as reputationCmd from "./commands/reputation";
import * as forumsCmd from "./commands/forums";
import * as topsCmd from "./commands/tops";
import * as economyConfigCmd from "./commands/economy-config";

const adminPanels: FeatureModule = {
  id: "admin-panels",
  commands: [
    { data: dashboardCmd.data, execute: dashboardCmd.execute },
    { data: channelsCmd.data, execute: channelsCmd.execute },
    { data: featuresCmd.data, execute: featuresCmd.execute },
    { data: rolesCmd.data, execute: rolesCmd.execute },
    { data: reputationCmd.data, execute: reputationCmd.execute },
    { data: forumsCmd.data, execute: forumsCmd.execute },
    { data: topsCmd.data, execute: topsCmd.execute },
    { data: economyConfigCmd.data, execute: economyConfigCmd.execute },
  ],
  components: [
    {
      prefix: PANEL_PREFIX,
      matches: (customId: string) => customId.startsWith(PANEL_PREFIX),
      handle: (interaction: ComponentInteraction) => handlePanelInteraction(interaction),
    },
  ],
};

export default adminPanels;

