import { PermissionFlagsBits } from "discord.js";
import { command } from "@/framework";
import { assertPanelPermission, openAdminPanel } from "../panels";

export default command("tops")
  .description("Open activity report configuration")
  .defaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .dmPermission(false)
  .subcommand("panel", "Open the tops panel")
  .hidden()
  .run(async ({ interaction }) => {
    if (!(await assertPanelPermission(interaction))) return;
    await openAdminPanel(interaction, "tops");
  });
