import type { ComponentInteraction } from "@/core/feature";
import type { Guild as GuildConfig } from "@/db/schemas/guild";
import { type PanelPayload, type PanelState, panelContainer } from "../panelRuntime";

/** Autoroles are managed through dedicated commands; this panel is a pointer only. */
export function render(_session: PanelState, _cfg: GuildConfig): PanelPayload {
  return {
    container: panelContainer({
      title: "Autoroles Panel",
      fields: [
        {
          name: "Configuration",
          value: "Use `/autorole list` and `/autorole enable|disable` for v2 autorole rules.",
        },
      ],
    }),
    actionRows: [],
  };
}

/** No interactive controls on this panel; all actions are no-ops. */
export async function action(
  _interaction: ComponentInteraction,
  _session: PanelState,
  _action: string,
): Promise<boolean> {
  return true;
}
