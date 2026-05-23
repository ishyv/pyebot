import type { ChatInputCommandInteraction } from "discord.js";
import type { CommandContext } from "@/core/feature";
import { defineCommand } from "@/framework";
import { data } from "./automod-data";
import { automodSubcommands } from "./subcommands";

async function execute(
  interaction: ChatInputCommandInteraction,
  ctx: CommandContext,
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();
  await automodSubcommands[subcommand]?.(interaction, ctx);
}

export default defineCommand({
  data,
  help: { hints: ["/mod help"] },
  execute,
});
