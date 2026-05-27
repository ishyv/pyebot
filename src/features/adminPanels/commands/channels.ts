import { type ChatInputCommandInteraction, PermissionFlagsBits } from "discord.js";
import { command } from "@/framework";
import { assertPanelPermission, openAdminPanel } from "../panels";

const data = command("channels")
  .setDescription("Manage bot-related channels")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .setDMPermission(false)
  .addSubcommand((sub) => sub.setName("panel").setDescription("Open the channels panel"));

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await assertPanelPermission(interaction))) return;
  await openAdminPanel(interaction, "channels");
}

export default data
  .hidden()
  .run(({ interaction, ctx }) =>
    (execute as (...args: never[]) => Promise<void>)(interaction as never, ctx as never),
  );
