import {
  type ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { defineCommand } from "@/framework";
import { assertPanelPermission, openAdminPanel } from "../panels";

const data = new SlashCommandBuilder()
  .setName("economy-config")
  .setDescription("Open economy configuration")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false)
  .addSubcommand((sub) => sub.setName("panel").setDescription("Open the economy config panel"));

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await assertPanelPermission(interaction))) return;
  await openAdminPanel(interaction, "economy");
}

export default defineCommand({
  data,
  help: false,
  execute,
});
