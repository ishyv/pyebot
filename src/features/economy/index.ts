import type { FeatureModule, ComponentInteraction } from "@/core/feature";
import type { ButtonInteraction } from "discord.js";
import { bus } from "@/core/bus";

// Commands
import * as balanceCmd from "./commands/balance";
import * as transferCmd from "./commands/transfer";
import * as workCmd from "./commands/work";
import * as coinflipCmd from "./commands/coinflip";
import * as triviaCmd from "./commands/trivia";
import * as robCmd from "./commands/rob";
import * as marketListCmd from "./commands/market-list";
import * as marketBuyCmd from "./commands/market-buy";
import * as marketBrowseCmd from "./commands/market-browse";
import * as marketCancelCmd from "./commands/market-cancel";
import * as questListCmd from "./commands/quest-list";
import * as questAcceptCmd from "./commands/quest-accept";
import * as questClaimCmd from "./commands/quest-claim";
import * as dailyCmd from "./commands/daily";
import * as bankCmd from "./commands/bank";
import * as ecoProfileCmd from "./commands/profile";
import * as inventoryCmd from "./commands/inventory";

// Component handlers
import { isTriviaButton, handleTriviaAnswer } from "./handlers/triviaAnswer";

// Quest/achievement progression (subscribed to bus events in onLoad)
import { progressAllQuests } from "./quests";

const economy: FeatureModule = {
  id: "economy",
  featureGate: "economy",
  commands: [
    { data: balanceCmd.data, execute: balanceCmd.execute },
    { data: transferCmd.data, execute: transferCmd.execute },
    { data: workCmd.data, execute: workCmd.execute },
    { data: coinflipCmd.data, execute: coinflipCmd.execute },
    { data: triviaCmd.data, execute: triviaCmd.execute },
    { data: robCmd.data, execute: robCmd.execute },
    { data: marketListCmd.data, execute: marketListCmd.execute },
    { data: marketBuyCmd.data, execute: marketBuyCmd.execute },
    { data: marketBrowseCmd.data, execute: marketBrowseCmd.execute },
    { data: marketCancelCmd.data, execute: marketCancelCmd.execute },
    { data: questListCmd.data, execute: questListCmd.execute },
    { data: questAcceptCmd.data, execute: questAcceptCmd.execute },
    { data: questClaimCmd.data, execute: questClaimCmd.execute },
    { data: dailyCmd.data, execute: dailyCmd.execute },
    { data: bankCmd.data, execute: bankCmd.execute },
    { data: ecoProfileCmd.data, execute: ecoProfileCmd.execute },
    { data: inventoryCmd.data, execute: inventoryCmd.execute },
  ],
  components: [
    {
      prefix: "trivia_answer:",
      matches: isTriviaButton,
      handle: (i: ComponentInteraction) => handleTriviaAnswer(i as ButtonInteraction),
    },
  ],
  onLoad() {
    // Subscribe to bus events so RPG actions can progress economy quests.
    // RPG services emit these events; economy listens and advances quest steps.
    bus.on("item:gathered", async (e) => {
      await progressAllQuests(e.userId, { kind: "gather_item", itemId: e.itemId, qty: e.qty });
    });
    bus.on("fight:won", async (e) => {
      await progressAllQuests(e.userId, { kind: "fight_win" });
    });
    bus.on("recipe:crafted", async (e) => {
      await progressAllQuests(e.userId, { kind: "craft_recipe", recipeId: e.recipeId, qty: e.qty });
    });
  },
};

export default economy;
