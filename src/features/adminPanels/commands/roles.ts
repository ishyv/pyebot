import { PermissionFlagsBits } from "discord.js";
import { command } from "@/framework";
import { assertPanelPermission, openAdminPanel } from "../panels";

export default command("roles")
  .description("Manage moderated role policies")
  .defaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .dmPermission(false)
  .subcommand({ name: "dashboard", description: "Open the role moderation dashboard" })
  .hidden()
  .run(async ({ interaction }) => {
    if (!(await assertPanelPermission(interaction))) return;
    await openAdminPanel(interaction, "roles");
  });
