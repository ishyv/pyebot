import { PermissionFlagsBits, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { assertPanelPermission, openAdminPanel } from "../panels";

export const data = new SlashCommandBuilder()
  .setName("forums")
  .setDescription("Open forum auto-reply configuration")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false)
  .addSubcommand((sub) => sub.setName("panel").setDescription("Open the forums panel"));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await assertPanelPermission(interaction))) return;
  await openAdminPanel(interaction, "forums");
}

