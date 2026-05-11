import { Button, Feature, SlashCommand } from "@/framework";
import type { ComponentInteraction } from "@/core/feature";
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

@Feature({ id: "admin-panels", intents: ["Guilds"] })
export default class AdminPanelsFeature {
  @SlashCommand({ name: dashboardCmd.data.name, description: "Open the admin dashboard", data: dashboardCmd.data })
  async dashboard(...args: Parameters<typeof dashboardCmd.execute>): Promise<void> {
    await dashboardCmd.execute(...args);
  }

  @SlashCommand({ name: channelsCmd.data.name, description: "Configure server channels", data: channelsCmd.data })
  async channels(...args: Parameters<typeof channelsCmd.execute>): Promise<void> {
    await channelsCmd.execute(...args);
  }

  @SlashCommand({ name: featuresCmd.data.name, description: "Configure feature gates", data: featuresCmd.data })
  async features(...args: Parameters<typeof featuresCmd.execute>): Promise<void> {
    await featuresCmd.execute(...args);
  }

  @SlashCommand({ name: rolesCmd.data.name, description: "Configure managed roles", data: rolesCmd.data })
  async roles(...args: Parameters<typeof rolesCmd.execute>): Promise<void> {
    await rolesCmd.execute(...args);
  }

  @SlashCommand({ name: reputationCmd.data.name, description: "Configure reputation", data: reputationCmd.data })
  async reputation(...args: Parameters<typeof reputationCmd.execute>): Promise<void> {
    await reputationCmd.execute(...args);
  }

  @SlashCommand({ name: forumsCmd.data.name, description: "Configure forum automation", data: forumsCmd.data })
  async forums(...args: Parameters<typeof forumsCmd.execute>): Promise<void> {
    await forumsCmd.execute(...args);
  }

  @SlashCommand({ name: topsCmd.data.name, description: "Configure top posts", data: topsCmd.data })
  async tops(...args: Parameters<typeof topsCmd.execute>): Promise<void> {
    await topsCmd.execute(...args);
  }

  @SlashCommand({ name: economyConfigCmd.data.name, description: "Configure economy settings", data: economyConfigCmd.data })
  async economyConfig(...args: Parameters<typeof economyConfigCmd.execute>): Promise<void> {
    await economyConfigCmd.execute(...args);
  }

  @Button({ prefix: PANEL_PREFIX })
  async panel(interaction: ComponentInteraction): Promise<void> {
    await handlePanelInteraction(interaction);
  }
}

