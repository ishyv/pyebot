import type { CommandContext } from "@/core/feature";
import { data } from "../automod-data";
import { automodSubcommands } from "./subcommands";

export default data.help({ hints: ["/mod help"] }).run(async (c) => {
  await automodSubcommands[c.subcommand ?? ""](c.interaction, c.ctx as unknown as CommandContext);
});
