import { Event, Feature, SlashCommand } from "@/framework";
import * as aiCmd from "./commands/ai";
import * as contextCmd from "./commands/context";
import { register as registerMessageCreate } from "./handlers/messageCreate";

@Feature({ id: "ai", intents: ["Guilds", "GuildMessages", "MessageContent"] })
export default class AiFeature {
  @SlashCommand({ name: aiCmd.data.name, description: "Configure AI", data: aiCmd.data })
  async ai(...args: Parameters<typeof aiCmd.execute>): Promise<void> {
    await aiCmd.execute(...args);
  }

  @SlashCommand({ name: contextCmd.data.name, description: "Summarize recent channel context", data: contextCmd.data })
  async context(...args: Parameters<typeof contextCmd.execute>): Promise<void> {
    await contextCmd.execute(...args);
  }

  @Event({ name: "messageCreate", intents: ["GuildMessages", "MessageContent"], register: registerMessageCreate })
  registerMessages(): void {}
}
