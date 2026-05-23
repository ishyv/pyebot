import type { ChatInputCommandInteraction } from "discord.js";
import type { CommandContext } from "@/core/feature";
import { assertPanelPermission, openAdminPanel } from "@/features/adminPanels/panels";

/** Handles `/automod panel` by delegating to the existing admin panel runtime. */
export async function handlePanel(
  interaction: ChatInputCommandInteraction,
  _ctx: CommandContext,
): Promise<void> {
  if (!(await assertPanelPermission(interaction))) return;
  await openAdminPanel(interaction, "automod");
}
