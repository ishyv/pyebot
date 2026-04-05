/**
 * Bootstrap — explicit, top-to-bottom readable.
 *
 * Order:
 * 1. Load env
 * 2. Connect MongoDB
 * 3. Load content packs
 * 4. Build command map from all feature command files
 * 5. Create Discord.js client
 * 6. Register interactionCreate → command dispatch + component handlers
 * 7. Register fight expiry interval
 * 8. Login
 * 9. On ready → upload slash commands via REST
 */

import "dotenv/config";

import { REST, Routes, type ChatInputCommandInteraction, type ButtonInteraction } from "discord.js";
import { createClient } from "@/core/client";
import { getDb, disconnectDb } from "@/core/db";
import { createLogger } from "@/core/logger";
import { loadContentRegistry } from "@/content/registry";

// ---------------------------------------------------------------------------
// Command imports (economy)
// ---------------------------------------------------------------------------
import * as balanceCmd from "@/features/economy/commands/balance";
import * as transferCmd from "@/features/economy/commands/transfer";
import * as workCmd from "@/features/economy/commands/work";
import * as coinflipCmd from "@/features/economy/commands/coinflip";
import * as triviaCmd from "@/features/economy/commands/trivia";
import * as robCmd from "@/features/economy/commands/rob";
import * as marketListCmd from "@/features/economy/commands/market-list";
import * as marketBuyCmd from "@/features/economy/commands/market-buy";
import * as marketBrowseCmd from "@/features/economy/commands/market-browse";
import * as marketCancelCmd from "@/features/economy/commands/market-cancel";
import * as questListCmd from "@/features/economy/commands/quest-list";
import * as questAcceptCmd from "@/features/economy/commands/quest-accept";
import * as questClaimCmd from "@/features/economy/commands/quest-claim";
import * as dailyCmd from "@/features/economy/commands/daily";
import * as bankCmd from "@/features/economy/commands/bank";
import * as ecoProfileCmd from "@/features/economy/commands/profile";
import * as inventoryCmd from "@/features/economy/commands/inventory";

// ---------------------------------------------------------------------------
// Command imports (RPG)
// ---------------------------------------------------------------------------
import * as fightCmd from "@/features/rpg/commands/fight";
import * as gatherMineCmd from "@/features/rpg/commands/gather-mine";
import * as gatherCutdownCmd from "@/features/rpg/commands/gather-cutdown";
import * as processCmd from "@/features/rpg/commands/process";
import * as rpgProfileCmd from "@/features/rpg/commands/profile";
import * as rpgQuestCmd from "@/features/rpg/commands/quest";

// ---------------------------------------------------------------------------
// Command imports (moderation)
// ---------------------------------------------------------------------------
import * as banCmd from "@/features/moderation/commands/ban";
import * as kickCmd from "@/features/moderation/commands/kick";
import * as muteCmd from "@/features/moderation/commands/mute";
import * as warnCmd from "@/features/moderation/commands/warn";
import * as unbanCmd from "@/features/moderation/commands/unban";
import * as casesCmd from "@/features/moderation/commands/cases";
import * as restrictCmd from "@/features/moderation/commands/restrict";
import * as modconfigCmd from "@/features/moderation/commands/modconfig";

// ---------------------------------------------------------------------------
// Command imports (tickets)
// ---------------------------------------------------------------------------
import * as ticketCmd from "@/features/tickets/commands/ticket";

// ---------------------------------------------------------------------------
// Command imports (autoroles)
// ---------------------------------------------------------------------------
import * as autoroleCmd from "@/features/autoroles/commands/autorole";

// ---------------------------------------------------------------------------
// Command imports (AI)
// ---------------------------------------------------------------------------
import * as aiCmd from "@/features/ai/commands/ai";

// ---------------------------------------------------------------------------
// Command imports (offers)
// ---------------------------------------------------------------------------
import * as offerCmd from "@/features/offers/commands/offer";

// ---------------------------------------------------------------------------
// Command imports (automod)
// ---------------------------------------------------------------------------
import * as automodCmd from "@/features/automod/commands/automod";

// ---------------------------------------------------------------------------
// Component / button handlers
// ---------------------------------------------------------------------------
import {
  isTriviaButton,
  handleTriviaAnswer,
} from "@/features/economy/handlers/triviaAnswer";
import {
  isFightAcceptButton,
  handleFightAccept,
} from "@/features/rpg/handlers/fightAccept";
import {
  isFightMoveButton,
  handleCombatMove,
} from "@/features/rpg/handlers/combatMove";
import {
  isOnboardButton,
  handleOnboard,
} from "@/features/rpg/handlers/onboard";
import { register as registerFightExpiry } from "@/features/rpg/handlers/fightExpiry";
import {
  isTicketCloseButton,
  handleTicketClose,
} from "@/features/tickets/handlers/close";
import { register as registerAutoroleJoin } from "@/features/autoroles/handlers/guildMemberAdd";
import { register as registerAutoroleReact } from "@/features/autoroles/handlers/messageReactionAdd";
import { register as registerAiMessageCreate } from "@/features/ai/handlers/messageCreate";
import { register as registerAutomodMessageCreate } from "@/features/automod/handlers/messageCreate";
import {
  isOfferReviewButton,
  handleOfferReview,
} from "@/features/offers/handlers/review";

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const log = createLogger("bootstrap");

type CommandModule = {
  data: { name: string; toJSON(): unknown };
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
};

const ALL_COMMANDS: CommandModule[] = [
  // economy
  balanceCmd, transferCmd, workCmd, coinflipCmd, triviaCmd, robCmd,
  marketListCmd, marketBuyCmd, marketBrowseCmd, marketCancelCmd,
  questListCmd, questAcceptCmd, questClaimCmd,
  dailyCmd, bankCmd, ecoProfileCmd, inventoryCmd,
  // rpg
  fightCmd, gatherMineCmd, gatherCutdownCmd, processCmd, rpgProfileCmd, rpgQuestCmd,
  // moderation
  banCmd, kickCmd, muteCmd, warnCmd, unbanCmd, casesCmd, restrictCmd, modconfigCmd,
  // tickets
  ticketCmd,
  // autoroles
  autoroleCmd,
  // ai
  aiCmd,
  // offers
  offerCmd,
  // automod
  automodCmd,
];

const commandMap = new Map<string, CommandModule>(
  ALL_COMMANDS.map((cmd) => [cmd.data.name, cmd]),
);

async function bootstrap(): Promise<void> {
  log.info("Starting tx-v2...");

  // 1. MongoDB
  await getDb();
  log.info("MongoDB connected.");

  // 2. Content packs (optional — gracefully skip if no pack dir)
  const contentDir = process.env.CONTENT_PACKS_DIR;
  if (contentDir) {
    const reg = await loadContentRegistry(contentDir);
    if (reg) {
      log.info(`Content registry loaded from ${reg.loadedFrom}`);
    }
  } else {
    log.info("CONTENT_PACKS_DIR not set — running without content packs.");
  }

  // 3. Discord client
  const client = createClient();

  // 4. Command + component routing
  client.on("interactionCreate", async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        const cmd = commandMap.get(interaction.commandName);
        if (cmd) {
          await cmd.execute(interaction as ChatInputCommandInteraction);
        } else {
          await (interaction as ChatInputCommandInteraction).reply({
            content: "Unknown command.",
            ephemeral: true,
          });
        }
        return;
      }

      if (interaction.isButton()) {
        const btn = interaction as ButtonInteraction;
        const cid = btn.customId;

        if (isTriviaButton(cid)) {
          await handleTriviaAnswer(btn);
        } else if (isFightAcceptButton(cid)) {
          await handleFightAccept(btn);
        } else if (isFightMoveButton(cid)) {
          await handleCombatMove(btn);
        } else if (isOnboardButton(cid)) {
          await handleOnboard(btn);
        } else if (isTicketCloseButton(cid)) {
          await handleTicketClose(btn);
        } else if (isOfferReviewButton(cid)) {
          await handleOfferReview(btn);
        }
        // unknown buttons are silently ignored
      }
    } catch (err) {
      log.error("Unhandled interaction error", err);
      try {
        const i = interaction as ChatInputCommandInteraction;
        const msg = { content: "An unexpected error occurred.", ephemeral: true };
        if (i.replied || i.deferred) {
          await i.followUp(msg);
        } else {
          await i.reply(msg);
        }
      } catch {
        // best-effort — ignore if we can't reply
      }
    }
  });

  // 5. Fight session expiry
  registerFightExpiry();
  log.info("Fight expiry interval registered.");

  // 6. Autorole event handlers
  registerAutoroleJoin(client);
  registerAutoroleReact(client);
  log.info("Autorole handlers registered.");

  // 7. AI messageCreate handler
  registerAiMessageCreate(client);
  log.info("AI messageCreate handler registered.");

  // 8. Automod messageCreate handler
  registerAutomodMessageCreate(client);
  log.info("Automod messageCreate handler registered.");

  // 6. Shutdown handling
  const shutdown = async () => {
    log.info("Shutting down...");
    await client.destroy();
    await disconnectDb();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // 7. Login
  const token = process.env.TOKEN;
  if (!token) throw new Error("TOKEN environment variable is not set.");
  await client.login(token);

  // 8. On ready — upload slash commands via REST
  client.once("ready", async (c) => {
    log.info(`Logged in as ${c.user.tag}`);

    const clientId = process.env.CLIENT_ID ?? c.user.id;
    const guildId = process.env.GUILD_ID; // set for dev guild-scoped deployment

    try {
      const rest = new REST().setToken(token);
      const body = ALL_COMMANDS.map((cmd) => cmd.data.toJSON());

      if (guildId) {
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
        log.info(`Registered ${body.length} guild commands (guild: ${guildId})`);
      } else {
        await rest.put(Routes.applicationCommands(clientId), { body });
        log.info(`Registered ${body.length} global commands`);
      }
    } catch (err) {
      log.error("Failed to register slash commands", err);
    }
  });
}

bootstrap().catch((err) => {
  log.error("Fatal startup error", err);
  process.exit(1);
});
