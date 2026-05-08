import type { ButtonInteraction } from "discord.js";
import { bus } from "@/core/bus";
import { Button, Feature, SlashCommand } from "@/framework";

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

@Feature({ id: "economy", gate: "economy", intents: ["Guilds"] })
export default class EconomyFeature {
  @SlashCommand({ name: balanceCmd.data.name, description: "Check balances", data: balanceCmd.data })
  async balance(...args: Parameters<typeof balanceCmd.execute>): Promise<void> {
    await balanceCmd.execute(...args);
  }

  @SlashCommand({ name: transferCmd.data.name, description: "Transfer currency", data: transferCmd.data })
  async transfer(...args: Parameters<typeof transferCmd.execute>): Promise<void> {
    await transferCmd.execute(...args);
  }

  @SlashCommand({ name: workCmd.data.name, description: "Work for currency", data: workCmd.data })
  async work(...args: Parameters<typeof workCmd.execute>): Promise<void> {
    await workCmd.execute(...args);
  }

  @SlashCommand({ name: coinflipCmd.data.name, description: "Flip a coin", data: coinflipCmd.data })
  async coinflip(...args: Parameters<typeof coinflipCmd.execute>): Promise<void> {
    await coinflipCmd.execute(...args);
  }

  @SlashCommand({ name: triviaCmd.data.name, description: "Play trivia", data: triviaCmd.data })
  async trivia(...args: Parameters<typeof triviaCmd.execute>): Promise<void> {
    await triviaCmd.execute(...args);
  }

  @SlashCommand({ name: robCmd.data.name, description: "Rob another user", data: robCmd.data })
  async rob(...args: Parameters<typeof robCmd.execute>): Promise<void> {
    await robCmd.execute(...args);
  }

  @SlashCommand({ name: marketListCmd.data.name, description: "List an item on the market", data: marketListCmd.data })
  async marketList(...args: Parameters<typeof marketListCmd.execute>): Promise<void> {
    await marketListCmd.execute(...args);
  }

  @SlashCommand({ name: marketBuyCmd.data.name, description: "Buy a market listing", data: marketBuyCmd.data })
  async marketBuy(...args: Parameters<typeof marketBuyCmd.execute>): Promise<void> {
    await marketBuyCmd.execute(...args);
  }

  @SlashCommand({ name: marketBrowseCmd.data.name, description: "Browse market listings", data: marketBrowseCmd.data })
  async marketBrowse(...args: Parameters<typeof marketBrowseCmd.execute>): Promise<void> {
    await marketBrowseCmd.execute(...args);
  }

  @SlashCommand({ name: marketCancelCmd.data.name, description: "Cancel a market listing", data: marketCancelCmd.data })
  async marketCancel(...args: Parameters<typeof marketCancelCmd.execute>): Promise<void> {
    await marketCancelCmd.execute(...args);
  }

  @SlashCommand({ name: questListCmd.data.name, description: "List quests", data: questListCmd.data })
  async questList(...args: Parameters<typeof questListCmd.execute>): Promise<void> {
    await questListCmd.execute(...args);
  }

  @SlashCommand({ name: questAcceptCmd.data.name, description: "Accept a quest", data: questAcceptCmd.data })
  async questAccept(...args: Parameters<typeof questAcceptCmd.execute>): Promise<void> {
    await questAcceptCmd.execute(...args);
  }

  @SlashCommand({ name: questClaimCmd.data.name, description: "Claim quest rewards", data: questClaimCmd.data })
  async questClaim(...args: Parameters<typeof questClaimCmd.execute>): Promise<void> {
    await questClaimCmd.execute(...args);
  }

  @SlashCommand({ name: dailyCmd.data.name, description: "Claim daily rewards", data: dailyCmd.data })
  async daily(...args: Parameters<typeof dailyCmd.execute>): Promise<void> {
    await dailyCmd.execute(...args);
  }

  @SlashCommand({ name: bankCmd.data.name, description: "Use the bank", data: bankCmd.data })
  async bank(...args: Parameters<typeof bankCmd.execute>): Promise<void> {
    await bankCmd.execute(...args);
  }

  @SlashCommand({ name: ecoProfileCmd.data.name, description: "View economy profile", data: ecoProfileCmd.data })
  async profile(...args: Parameters<typeof ecoProfileCmd.execute>): Promise<void> {
    await ecoProfileCmd.execute(...args);
  }

  @SlashCommand({ name: inventoryCmd.data.name, description: "View inventory", data: inventoryCmd.data })
  async inventory(...args: Parameters<typeof inventoryCmd.execute>): Promise<void> {
    await inventoryCmd.execute(...args);
  }

  @Button<ButtonInteraction>({ prefix: "trivia_answer:", matches: isTriviaButton })
  async triviaAnswer(interaction: ButtonInteraction): Promise<void> {
    await handleTriviaAnswer(interaction);
  }

  onLoad() {
    bus.on("item:gathered", async (e) => {
      await progressAllQuests(e.userId, { kind: "gather_item", itemId: e.itemId, qty: e.qty });
    });
    bus.on("fight:won", async (e) => {
      await progressAllQuests(e.userId, { kind: "fight_win" });
    });
    bus.on("recipe:crafted", async (e) => {
      await progressAllQuests(e.userId, { kind: "craft_recipe", recipeId: e.recipeId, qty: e.qty });
    });
  }
}
