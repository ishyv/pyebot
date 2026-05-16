import {
  type ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { defineCommand } from "@/framework";
import { assertPanelPermission, openAdminPanel } from "../panels";

const data = new SlashCommandBuilder()
  .setName("channels")
  .setDescription("Manage bot-related channels")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .setDMPermission(false)
  .addSubcommand((sub) => sub.setName("panel").setDescription("Open the channels panel"));

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await assertPanelPermission(interaction))) return;
  await openAdminPanel(interaction, "channels");
}

export default defineCommand({
  data,
  help: false,
  execute,
});
