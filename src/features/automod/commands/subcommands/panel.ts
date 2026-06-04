import type { ChatInputCommandInteraction } from "discord.js";
import { assertPanelPermission, openAdminPanel } from "@/features/adminPanels/panels";
import type { AutomodSubcommandContext } from "./types";

/** Handles `/automod panel` by delegating to the existing admin panel runtime. */
export async function handlePanel(
  interaction: ChatInputCommandInteraction,
  _ctx: AutomodSubcommandContext,
): Promise<void> {
  if (!(await assertPanelPermission(interaction))) return;
  await openAdminPanel(interaction, "automod");
}
