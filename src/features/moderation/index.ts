import type { Client } from "discord.js";
import type { FeatureModule, ComponentInteraction } from "@/core/feature";
import type { ButtonInteraction } from "discord.js";
import * as banCmd from "./commands/ban";
import * as kickCmd from "./commands/kick";
import * as muteCmd from "./commands/mute";
import * as warnCmd from "./commands/warn";
import * as casesCmd from "./commands/cases";
import * as caseCmd from "./commands/case";
import * as noteCmd from "./commands/note";
import * as modsetCmd from "./commands/modset";
import * as quarantineCmd from "./commands/quarantine";
import * as purgeCmd from "./commands/purge";
import * as lockdownCmd from "./commands/lockdown";
import { registerVerification } from "./verification";
import { registerAltDetection } from "./altDetection";
import {
  isAppealButton, handleAppealButton,
  isAppealApprove, handleAppealApprove,
  isAppealDeny, handleAppealDeny,
} from "./handlers/appealButton";
import { isVerifyButton, handleVerifyButton } from "./handlers/verifyButton";
import { getExpiredTempBans, deleteTempBan } from "@/db/repositories/tempBans";
import { createLogger } from "@/core/logger";

const log = createLogger("moderation:temp-bans");

async function sweepTempBans(client: Client): Promise<void> {
  const result = await getExpiredTempBans();
  if (result.isErr()) return;

  for (const entry of result.unwrap()) {
    const guild = client.guilds.cache.get(entry.guildId);
    if (!guild) continue;

    try {
      await guild.members.unban(entry.userId, "Temporary ban expired");
    } catch (err) {
      log.error("Failed to unban expired temp ban", { guildId: entry.guildId, userId: entry.userId, err });
    }

    await deleteTempBan(entry.guildId, entry.userId);
  }
}

// Moderation has no featureGate — it should always be available to servers.
const moderation: FeatureModule = {
  id: "moderation",
  commands: [
    { data: banCmd.data, execute: banCmd.execute },
    { data: kickCmd.data, execute: kickCmd.execute },
    { data: muteCmd.data, execute: muteCmd.execute },
    { data: warnCmd.data, execute: warnCmd.execute },
    { data: casesCmd.data, execute: casesCmd.execute },
    { data: caseCmd.data, execute: caseCmd.execute },
    { data: noteCmd.data, execute: noteCmd.execute },
    { data: modsetCmd.data, execute: modsetCmd.execute },
    { data: quarantineCmd.data, execute: quarantineCmd.execute },
    { data: purgeCmd.data, execute: purgeCmd.execute },
    { data: lockdownCmd.data, execute: lockdownCmd.execute },
  ],
  components: [
    {
      prefix: "mod:appeal:",
      matches: isAppealButton,
      handle: (i: ComponentInteraction) => handleAppealButton(i as ButtonInteraction),
    },
    {
      prefix: "mod:appeal:approve:",
      matches: isAppealApprove,
      handle: (i: ComponentInteraction) => handleAppealApprove(i as ButtonInteraction),
    },
    {
      prefix: "mod:appeal:deny:",
      matches: isAppealDeny,
      handle: (i: ComponentInteraction) => handleAppealDeny(i as ButtonInteraction),
    },
    {
      prefix: "mod:verify:",
      matches: isVerifyButton,
      handle: (i: ComponentInteraction) => handleVerifyButton(i as ButtonInteraction),
    },
  ],
  events: [
    { event: "guildMemberAdd", register: registerVerification },
    { event: "guildMemberAdd", register: registerAltDetection },
  ],
  onLoad() {
    // Sweep expired temp bans every 60 seconds
    setInterval(() => {
      // We don't have the client here; sweeping requires the client — done in onReady instead
    }, 60_000);
  },
  onReady(client: Client) {
    // Sweep on startup to catch bans that expired during downtime
    sweepTempBans(client).catch((err) => log.error("Startup temp ban sweep failed", err));

    // Repeat every 60 seconds
    setInterval(() => {
      sweepTempBans(client).catch((err) => log.error("Temp ban sweep failed", err));
    }, 60_000);
  },
};

export default moderation;
