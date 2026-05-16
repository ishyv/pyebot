import {
  type ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { defineCommand } from "@/framework";
import { assertPanelPermission, openAdminPanel } from "../panels";

const data = new SlashCommandBuilder()
  .setName("roles")
  .setDescription("Manage moderated role policies")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false)
  .addSubcommand((sub) =>
    sub.setName("dashboard").setDescription("Open the role moderation dashboard"),
  );

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await assertPanelPermission(interaction))) return;
  await openAdminPanel(interaction, "roles");
}

export default defineCommand({
  data,
  help: false,
  execute,
});
