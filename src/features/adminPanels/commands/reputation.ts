import {
  type ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { defineCommand } from "@/framework";
import { assertPanelPermission, openAdminPanel } from "../panels";

const data = new SlashCommandBuilder()
  .setName("rep")
  .setDescription("Open reputation configuration")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false)
  .addSubcommand((sub) => sub.setName("panel").setDescription("Open the reputation panel"));

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await assertPanelPermission(interaction))) return;
  await openAdminPanel(interaction, "reputation");
}

export default defineCommand({
  data,
  help: false,
  execute,
});
