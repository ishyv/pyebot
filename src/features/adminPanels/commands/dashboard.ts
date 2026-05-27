import { type ChatInputCommandInteraction, PermissionFlagsBits } from "discord.js";
import { command } from "@/framework";
import { assertPanelPermission, openAdminPanel } from "../panels";

const data = command("dashboard")
  .setDescription("Open the admin dashboard")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false);

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await assertPanelPermission(interaction))) return;
  await openAdminPanel(interaction, "home");
}

export default data
  .hidden()
  .run(({ interaction, ctx }) =>
    (execute as (...args: never[]) => Promise<void>)(interaction as never, ctx as never),
  );
