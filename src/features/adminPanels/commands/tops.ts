import { PermissionFlagsBits, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { assertPanelPermission, openAdminPanel } from "../panels";

export const data = new SlashCommandBuilder()
  .setName("tops")
  .setDescription("Open activity report configuration")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false)
  .addSubcommand((sub) => sub.setName("panel").setDescription("Open the tops panel"));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await assertPanelPermission(interaction))) return;
  await openAdminPanel(interaction, "tops");
}

