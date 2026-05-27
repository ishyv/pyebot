import { PermissionFlagsBits } from "discord.js";
import { command } from "@/framework";
import { assertPanelPermission, openAdminPanel } from "../panels";

export default command("features")
  .description("Open guild feature flags")
  .defaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .dmPermission(false)
  .hidden()
  .run(async ({ interaction }) => {
    if (!(await assertPanelPermission(interaction))) return;
    await openAdminPanel(interaction, "features");
  });
