import { Event, Feature, SlashCommand } from "@/framework";
import * as autoroleCmd from "./commands/autorole";
import { register as registerJoin } from "./handlers/guildMemberAdd";
import { register as registerReact } from "./handlers/messageReactionAdd";

@Feature({ id: "autoroles", gate: "autoroles", intents: ["Guilds", "GuildMembers", "GuildMessageReactions"] })
export default class AutorolesFeature {
  @SlashCommand({ name: autoroleCmd.data.name, description: "Configure autoroles", data: autoroleCmd.data })
  async autorole(...args: Parameters<typeof autoroleCmd.execute>): Promise<void> {
    await autoroleCmd.execute(...args);
  }

  @Event({ name: "guildMemberAdd", intents: ["GuildMembers"], register: registerJoin })
  registerJoin(): void {}

  @Event({ name: "messageReactionAdd", intents: ["GuildMessageReactions"], register: registerReact })
  registerReaction(): void {}
}
