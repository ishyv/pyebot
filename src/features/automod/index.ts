import type { ButtonInteraction } from "discord.js";
import { Button, Event, Feature, Job, SlashCommand } from "@/framework";
import * as automodCmd from "./commands/automod";
import { register as registerMessageCreate } from "./handlers/messageCreate";
import { pruneCrossChannelSpam } from "./crossChannelSpam";
import { pruneMentionSpam } from "./mentionSpam";
import { pruneSlowmodeMessages } from "./slowmode";
import { registerRaidDetection, pruneRaidDetectionHistory } from "./raidDetection";
import {
  isSpamTimeout, handleSpamTimeout,
  isSpamBan, handleSpamBan,
  isSpamDismiss, handleSpamDismiss,
} from "./handlers/spamAlert";
import {
  isRaidLockdown, handleRaidLockdown,
  isRaidDismiss, handleRaidDismiss,
} from "./handlers/raidAlert";

@Feature({ id: "automod", gate: "automod", intents: ["Guilds", "GuildMessages", "MessageContent", "GuildMembers"] })
export default class AutomodFeature {
  @SlashCommand({ name: automodCmd.data.name, description: "Configure automod", data: automodCmd.data })
  async automod(...args: Parameters<typeof automodCmd.execute>): Promise<void> {
    await automodCmd.execute(...args);
  }

  @Button<ButtonInteraction>({ prefix: "automod:spam:timeout:", matches: isSpamTimeout })
  async spamTimeout(interaction: ButtonInteraction): Promise<void> {
    await handleSpamTimeout(interaction);
  }

  @Button<ButtonInteraction>({ prefix: "automod:spam:ban:", matches: isSpamBan })
  async spamBan(interaction: ButtonInteraction): Promise<void> {
    await handleSpamBan(interaction);
  }

  @Button<ButtonInteraction>({ prefix: "automod:spam:dismiss:", matches: isSpamDismiss })
  async spamDismiss(interaction: ButtonInteraction): Promise<void> {
    await handleSpamDismiss(interaction);
  }

  @Button<ButtonInteraction>({ prefix: "automod:raid:lockdown:", matches: isRaidLockdown })
  async raidLockdown(interaction: ButtonInteraction): Promise<void> {
    await handleRaidLockdown(interaction);
  }

  @Button<ButtonInteraction>({ prefix: "automod:raid:dismiss:", matches: isRaidDismiss })
  async raidDismiss(interaction: ButtonInteraction): Promise<void> {
    await handleRaidDismiss(interaction);
  }

  @Event({ name: "messageCreate", intents: ["GuildMessages", "MessageContent"], register: registerMessageCreate })
  registerMessages(): void {}

  @Event({ name: "guildMemberAdd", intents: ["GuildMembers"], register: registerRaidDetection })
  registerRaidDetection(): void {}

  @Job({ name: "automod-cross-channel-prune", everyMs: 5 * 60 * 1000, runOnReady: true })
  pruneCrossChannel(): void {
    pruneCrossChannelSpam();
  }

  @Job({ name: "automod-mention-prune", everyMs: 5 * 60 * 1000, runOnReady: true })
  pruneMentions(): void {
    pruneMentionSpam();
  }

  @Job({ name: "automod-slowmode-prune", everyMs: 5 * 60 * 1000, runOnReady: true })
  pruneSlowmode(): void {
    pruneSlowmodeMessages();
  }

  @Job({ name: "automod-raid-prune", everyMs: 5 * 60 * 1000, runOnReady: true })
  pruneRaids(): void {
    pruneRaidDetectionHistory();
  }
}
