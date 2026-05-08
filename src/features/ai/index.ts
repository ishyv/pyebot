import { Event, Feature, SlashCommand } from "@/framework";
import * as aiCmd from "./commands/ai";
import { register as registerMessageCreate } from "./handlers/messageCreate";

@Feature({ id: "ai", intents: ["Guilds", "GuildMessages", "MessageContent"] })
export default class AiFeature {
  @SlashCommand({ name: aiCmd.data.name, description: "Configure AI", data: aiCmd.data })
  async ai(...args: Parameters<typeof aiCmd.execute>): Promise<void> {
    await aiCmd.execute(...args);
  }

  @Event({ name: "messageCreate", intents: ["GuildMessages", "MessageContent"], register: registerMessageCreate })
  registerMessages(): void {}
}
