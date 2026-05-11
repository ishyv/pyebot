import type { Client } from "discord.js";
import type { ButtonInteraction } from "discord.js";
import { Button, Event, Feature, Job, SlashCommand } from "@/framework";
import * as banCmd from "./commands/ban";
import * as modCmd from "./commands/mod";
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

@Feature({ id: "moderation", intents: ["Guilds", "GuildMembers", "GuildModeration"] })
export default class ModerationFeature {
  @SlashCommand({ name: modCmd.data.name, description: "Moderation help", data: modCmd.data })
  async mod(...args: Parameters<typeof modCmd.execute>): Promise<void> {
    await modCmd.execute(...args);
  }

  @SlashCommand({ name: banCmd.data.name, description: "Ban a user", data: banCmd.data })
  async ban(...args: Parameters<typeof banCmd.execute>): Promise<void> {
    await banCmd.execute(...args);
  }

  @SlashCommand({ name: kickCmd.data.name, description: "Kick a user", data: kickCmd.data })
  async kick(...args: Parameters<typeof kickCmd.execute>): Promise<void> {
    await kickCmd.execute(...args);
  }

  @SlashCommand({ name: muteCmd.data.name, description: "Mute a user", data: muteCmd.data })
  async mute(...args: Parameters<typeof muteCmd.execute>): Promise<void> {
    await muteCmd.execute(...args);
  }

  @SlashCommand({ name: warnCmd.data.name, description: "Warn a user", data: warnCmd.data })
  async warn(...args: Parameters<typeof warnCmd.execute>): Promise<void> {
    await warnCmd.execute(...args);
  }

  @SlashCommand({ name: casesCmd.data.name, description: "View moderation cases", data: casesCmd.data })
  async cases(...args: Parameters<typeof casesCmd.execute>): Promise<void> {
    await casesCmd.execute(...args);
  }

  @SlashCommand({ name: caseCmd.data.name, description: "View a moderation case", data: caseCmd.data })
  async modCase(...args: Parameters<typeof caseCmd.execute>): Promise<void> {
    await caseCmd.execute(...args);
  }

  @SlashCommand({ name: noteCmd.data.name, description: "Manage moderation notes", data: noteCmd.data })
  async note(...args: Parameters<typeof noteCmd.execute>): Promise<void> {
    await noteCmd.execute(...args);
  }

  @SlashCommand({ name: modsetCmd.data.name, description: "Configure moderation", data: modsetCmd.data })
  async modset(...args: Parameters<typeof modsetCmd.execute>): Promise<void> {
    await modsetCmd.execute(...args);
  }

  @SlashCommand({ name: quarantineCmd.data.name, description: "Quarantine a user", data: quarantineCmd.data })
  async quarantine(...args: Parameters<typeof quarantineCmd.execute>): Promise<void> {
    await quarantineCmd.execute(...args);
  }

  @SlashCommand({ name: purgeCmd.data.name, description: "Purge messages", data: purgeCmd.data })
  async purge(...args: Parameters<typeof purgeCmd.execute>): Promise<void> {
    await purgeCmd.execute(...args);
  }

  @SlashCommand({ name: lockdownCmd.data.name, description: "Lock down a channel", data: lockdownCmd.data })
  async lockdown(...args: Parameters<typeof lockdownCmd.execute>): Promise<void> {
    await lockdownCmd.execute(...args);
  }

  @Button<ButtonInteraction>({ prefix: "mod:appeal:", matches: isAppealButton })
  async appeal(interaction: ButtonInteraction): Promise<void> {
    await handleAppealButton(interaction);
  }

  @Button<ButtonInteraction>({ prefix: "mod:appeal:approve:", matches: isAppealApprove })
  async appealApprove(interaction: ButtonInteraction): Promise<void> {
    await handleAppealApprove(interaction);
  }

  @Button<ButtonInteraction>({ prefix: "mod:appeal:deny:", matches: isAppealDeny })
  async appealDeny(interaction: ButtonInteraction): Promise<void> {
    await handleAppealDeny(interaction);
  }

  @Button<ButtonInteraction>({ prefix: "mod:verify:", matches: isVerifyButton })
  async verify(interaction: ButtonInteraction): Promise<void> {
    await handleVerifyButton(interaction);
  }

  @Event({ name: "guildMemberAdd", intents: ["GuildMembers"], register: registerVerification })
  registerVerification(): void {}

  @Event({ name: "guildMemberAdd", intents: ["GuildMembers"], register: registerAltDetection })
  registerAltDetection(): void {}

  @Job({ name: "temp-ban-sweep", everyMs: 60_000, runOnReady: true })
  async sweepTempBans(client: Client): Promise<void> {
    await sweepTempBans(client);
  }
}
