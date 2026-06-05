import { data } from "../automod-data";
import { automodSubcommands } from "./subcommands";

export default data.help({ hints: ["/mod help"] }).run(async (c) => {
  await automodSubcommands[c.subcommand ?? ""](c.interaction, {
    guildId: c.guildId,
    respond: c.ctx.respond,
    entities: c.ctx,
  });
});
