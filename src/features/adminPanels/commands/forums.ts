import { PermissionFlagsBits } from "discord.js";
import { command } from "@/framework";
import { assertPanelPermission, openAdminPanel } from "../panels";

export default command("forums")
  .description("Open forum auto-reply configuration")
  .defaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .dmPermission(false)
  .subcommand("panel", "Open the forums panel")
  .hidden()
  .run(async ({ interaction }) => {
    if (!(await assertPanelPermission(interaction))) return;
    await openAdminPanel(interaction, "forums");
  });
