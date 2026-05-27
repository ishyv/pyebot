import { PermissionFlagsBits } from "discord.js";
import { command } from "@/framework";
import { assertPanelPermission, openAdminPanel } from "../panels";

export default command("channels")
  .description("Manage bot-related channels")
  .defaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .dmPermission(false)
  .subcommand("panel", "Open the channels panel")
  .hidden()
  .run(async ({ interaction }) => {
    if (!(await assertPanelPermission(interaction))) return;
    await openAdminPanel(interaction, "channels");
  });
