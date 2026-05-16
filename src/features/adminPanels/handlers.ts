import type { ComponentInteraction } from "@/core/feature";
import { Handle } from "@/framework";
import { PANEL_PREFIX } from "./panelRuntime";
import { handlePanelInteraction } from "./panels";

export default class AdminPanelHandlers {
  @Handle(PANEL_PREFIX)
  async onPanelInteraction(interaction: ComponentInteraction): Promise<void> {
    await handlePanelInteraction(interaction);
  }
}
