import type { ChatInputCommandInteraction } from "discord.js";
import type { CommandContext } from "@/core/feature";
import { data } from "../automod-data";
import { automodSubcommands } from "./subcommands";

async function execute(
  interaction: ChatInputCommandInteraction,
  ctx: CommandContext,
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();
  await automodSubcommands[subcommand]?.(interaction, ctx);
}

export default data
  .help({ hints: ["/mod help"] })
  .run(({ interaction, ctx }) =>
    (execute as (...args: never[]) => Promise<void>)(interaction as never, ctx as never),
  );
