import { Event, Feature } from "@/framework";
import { register as registerMessageCreate } from "./handlers/messageCreate";
import { countingFeatureConfig } from "./config";

@Feature({
  id: "counting",
  gate: "counting",
  config: countingFeatureConfig,
  intents: ["GuildMessages", "MessageContent"],
})
export default class CountingFeature {
  @Event({ name: "messageCreate", intents: ["GuildMessages", "MessageContent"], register: registerMessageCreate })
  registerMessages(): void {}
}
