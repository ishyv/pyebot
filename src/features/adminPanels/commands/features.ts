import {
  type ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { defineCommand } from "@/framework";
import { assertPanelPermission, openAdminPanel } from "../panels";

const data = new SlashCommandBuilder()
  .setName("features")
  .setDescription("Open guild feature flags")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false);

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await assertPanelPermission(interaction))) return;
  await openAdminPanel(interaction, "features");
}

export default defineCommand({
  data,
  help: false,
  execute,
});
