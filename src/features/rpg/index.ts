import type { ButtonInteraction } from "discord.js";
import { Button, Feature, Job, SlashCommand } from "@/framework";

// Commands
import * as fightCmd from "./commands/fight";
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
import { isExpeditionButton, handleExpeditionButton } from "./handlers/expedition";

import { expirePendingFights } from "./handlers/fightExpiry";

@Feature({ id: "rpg", gate: "game", intents: ["Guilds"] })
export default class RpgFeature {
  @SlashCommand({ name: fightCmd.data.name, description: "Start a fight", data: fightCmd.data })
  async fight(...args: Parameters<typeof fightCmd.execute>): Promise<void> {
    await fightCmd.execute(...args);
  }

  @SlashCommand({ name: processCmd.data.name, description: "Process materials", data: processCmd.data })
  async process(...args: Parameters<typeof processCmd.execute>): Promise<void> {
    await processCmd.execute(...args);
  }

  @SlashCommand({ name: rpgProfileCmd.data.name, description: "View RPG profile", data: rpgProfileCmd.data })
  async profile(...args: Parameters<typeof rpgProfileCmd.execute>): Promise<void> {
    await rpgProfileCmd.execute(...args);
  }

  @SlashCommand({ name: rpgQuestCmd.data.name, description: "Manage RPG quests", data: rpgQuestCmd.data })
  async quest(...args: Parameters<typeof rpgQuestCmd.execute>): Promise<void> {
    await rpgQuestCmd.execute(...args);
  }

  @SlashCommand({ name: expeditionCmd.data.name, description: "Run an expedition", data: expeditionCmd.data })
  async expedition(...args: Parameters<typeof expeditionCmd.execute>): Promise<void> {
    await expeditionCmd.execute(...args);
  }

  @SlashCommand({ name: hideoutCmd.data.name, description: "Manage hideout", data: hideoutCmd.data })
  async hideout(...args: Parameters<typeof hideoutCmd.execute>): Promise<void> {
    await hideoutCmd.execute(...args);
  }

  @SlashCommand({ name: craftCmd.data.name, description: "Craft items", data: craftCmd.data })
  async craft(...args: Parameters<typeof craftCmd.execute>): Promise<void> {
    await craftCmd.execute(...args);
  }

  @Button<ButtonInteraction>({ prefix: "fight_accept:", matches: isFightAcceptButton })
  async fightAccept(interaction: ButtonInteraction): Promise<void> {
    await handleFightAccept(interaction);
  }

  @Button<ButtonInteraction>({ prefix: "fight_move:", matches: isFightMoveButton })
  async combatMove(interaction: ButtonInteraction): Promise<void> {
    await handleCombatMove(interaction);
  }

  @Button<ButtonInteraction>({ prefix: "rpg:onboard:", matches: isOnboardButton })
  async onboard(interaction: ButtonInteraction): Promise<void> {
    await handleOnboard(interaction);
  }

  @Button<ButtonInteraction>({ prefix: "expedition:", matches: isExpeditionButton })
  async expeditionButton(interaction: ButtonInteraction): Promise<void> {
    await handleExpeditionButton(interaction);
  }

  @Job({ name: "fight-expiry", everyMs: 60_000, runOnReady: true })
  expireFights(): void {
    expirePendingFights();
  }
}
