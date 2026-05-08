import type { FeatureModule } from "@/core/feature";
import { register as registerMessageCreate } from "./handlers/messageCreate";
import { countingFeatureConfig } from "./config";

const counting: FeatureModule = {
  id: "counting",
  featureGate: "counting",
  config: countingFeatureConfig,
  capabilities: {
    discordIntents: ["GuildMessages", "MessageContent"],
  },
  commands: [],
  events: [
    { event: "messageCreate", register: registerMessageCreate },
  ],
};

export default counting;
