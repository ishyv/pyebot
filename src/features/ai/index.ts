import type { FeatureModule } from "@/core/feature";
import * as aiCmd from "./commands/ai";
import { register as registerMessageCreate } from "./handlers/messageCreate";

const ai: FeatureModule = {
  id: "ai",
  commands: [
    { data: aiCmd.data, execute: aiCmd.execute },
  ],
  events: [
    { event: "messageCreate", register: registerMessageCreate },
  ],
};

export default ai;
