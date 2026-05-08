import type { FeatureModule, ComponentInteraction } from "@/core/feature";
import type { ButtonInteraction } from "discord.js";

// Commands
import * as fightCmd from "./commands/fight";
import * as gatherMineCmd from "./commands/gather-mine";
import * as gatherCutdownCmd from "./commands/gather-cutdown";
import * as processCmd from "./commands/process";
import * as rpgProfileCmd from "./commands/profile";
import * as rpgQuestCmd from "./commands/quest";
import * as expeditionCmd from "./commands/expedition";
import * as hideoutCmd from "./commands/hideout";
import * as craftCmd from "./commands/craft";


// Component handlers
import { isFightAcceptButton, handleFightAccept } from "./handlers/fightAccept";
import { isFightMoveButton, handleCombatMove } from "./handlers/combatMove";
import { isOnboardButton, handleOnboard } from "./handlers/onboard";
import { isExpeditionButton, handleExpeditionButton } from "./handlers/expeditionHandlers";

// Interval
import { register as registerFightExpiry } from "./handlers/fightExpiry";

const rpg: FeatureModule = {
  id: "rpg",
  featureGate: "game",
  commands: [
    { data: fightCmd.data, execute: fightCmd.execute },
    { data: gatherMineCmd.data, execute: gatherMineCmd.execute },
    { data: gatherCutdownCmd.data, execute: gatherCutdownCmd.execute },
    { data: processCmd.data, execute: processCmd.execute },
    { data: rpgProfileCmd.data, execute: rpgProfileCmd.execute },
    { data: rpgQuestCmd.data, execute: rpgQuestCmd.execute },
    { data: expeditionCmd.data, execute: expeditionCmd.execute },
    { data: hideoutCmd.data, execute: hideoutCmd.execute },
    { data: craftCmd.data, execute: craftCmd.execute },

  ],
  components: [
    {
      prefix: "fight_accept:",
      matches: isFightAcceptButton,
      handle: (i: ComponentInteraction) => handleFightAccept(i as ButtonInteraction),
    },
    {
      prefix: "fight_move:",
      matches: isFightMoveButton,
      handle: (i: ComponentInteraction) => handleCombatMove(i as ButtonInteraction),
    },
    {
      prefix: "rpg:onboard:",
      matches: isOnboardButton,
      handle: (i: ComponentInteraction) => handleOnboard(i as ButtonInteraction),
    },
    {
      prefix: "expedition_",
      matches: isExpeditionButton,
      handle: (i: ComponentInteraction) => handleExpeditionButton(i as ButtonInteraction),
    },
  ],
  onLoad() {
    // Start the fight session expiry interval (cleans up stale pending fights every minute)
    registerFightExpiry();
  },
};

export default rpg;
