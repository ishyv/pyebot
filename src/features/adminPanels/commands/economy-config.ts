import { PermissionFlagsBits } from "discord.js";
import { command } from "@/framework";
import { assertPanelPermission, openAdminPanel } from "../panels";

export default command("economy-config")
  .description("Open economy configuration")
  .defaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .dmPermission(false)
  .subcommand({ name: "panel", description: "Open the economy config panel" })
  .hidden()
  .run(async ({ interaction }) => {
    if (!(await assertPanelPermission(interaction))) return;
    await openAdminPanel(interaction, "economy");
  });
