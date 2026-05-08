import { PermissionFlagsBits, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { assertPanelPermission, openAdminPanel } from "../panels";

export const data = new SlashCommandBuilder()
  .setName("dashboard")
  .setDescription("Open the admin dashboard")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await assertPanelPermission(interaction))) return;
  await openAdminPanel(interaction, "home");
}

