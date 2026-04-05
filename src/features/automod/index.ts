import type { FeatureModule, ComponentInteraction } from "@/core/feature";
import type { ButtonInteraction } from "discord.js";
import * as automodCmd from "./commands/automod";
import { register as registerMessageCreate } from "./handlers/messageCreate";
import { startCleanupInterval } from "./crossChannelSpam";
import { startMentionSpamCleanup } from "./mentionSpam";
import { startSlowmodeCleanup } from "./slowmode";
import { registerRaidDetection, startRaidDetectionCleanup } from "./raidDetection";
import {
  isSpamTimeout, handleSpamTimeout,
  isSpamBan, handleSpamBan,
  isSpamDismiss, handleSpamDismiss,
} from "./handlers/spamAlert";
import {
  isRaidLockdown, handleRaidLockdown,
  isRaidDismiss, handleRaidDismiss,
} from "./handlers/raidAlert";

const automod: FeatureModule = {
  id: "automod",
  featureGate: "automod",
  commands: [
    { data: automodCmd.data, execute: automodCmd.execute },
  ],
  components: [
    {
      prefix: "automod:spam:timeout:",
      matches: isSpamTimeout,
      handle: (i: ComponentInteraction) => handleSpamTimeout(i as ButtonInteraction),
    },
    {
      prefix: "automod:spam:ban:",
      matches: isSpamBan,
      handle: (i: ComponentInteraction) => handleSpamBan(i as ButtonInteraction),
    },
    {
      prefix: "automod:spam:dismiss:",
      matches: isSpamDismiss,
      handle: (i: ComponentInteraction) => handleSpamDismiss(i as ButtonInteraction),
    },
    {
      prefix: "automod:raid:lockdown:",
      matches: isRaidLockdown,
      handle: (i: ComponentInteraction) => handleRaidLockdown(i as ButtonInteraction),
    },
    {
      prefix: "automod:raid:dismiss:",
      matches: isRaidDismiss,
      handle: (i: ComponentInteraction) => handleRaidDismiss(i as ButtonInteraction),
    },
  ],
  events: [
    { event: "messageCreate", register: registerMessageCreate },
    { event: "guildMemberAdd", register: registerRaidDetection },
  ],
  onLoad() {
    startCleanupInterval();
    startMentionSpamCleanup();
    startSlowmodeCleanup();
    startRaidDetectionCleanup();
  },
};

export default automod;
