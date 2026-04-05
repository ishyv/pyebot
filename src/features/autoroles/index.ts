import type { FeatureModule } from "@/core/feature";
import * as autoroleCmd from "./commands/autorole";
import { register as registerJoin } from "./handlers/guildMemberAdd";
import { register as registerReact } from "./handlers/messageReactionAdd";

const autoroles: FeatureModule = {
  id: "autoroles",
  featureGate: "autoroles",
  commands: [
    { data: autoroleCmd.data, execute: autoroleCmd.execute },
  ],
  events: [
    { event: "guildMemberAdd", register: registerJoin },
    { event: "messageReactionAdd", register: registerReact },
  ],
};

export default autoroles;
