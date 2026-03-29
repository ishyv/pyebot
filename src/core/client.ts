import { Client, GatewayIntentBits, Partials } from "discord.js";

const INTENTS = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.GuildMessageReactions,
  GatewayIntentBits.MessageContent,
  GatewayIntentBits.DirectMessages,
  GatewayIntentBits.GuildModeration,
  GatewayIntentBits.GuildVoiceStates,
];

const PARTIALS = [
  Partials.Message,
  Partials.Channel,
  Partials.Reaction,
  Partials.GuildMember,
  Partials.User,  // required for partial DM reaction users
];

/**
 * Creates a Discord.js Client with the intents and partials required by tx-v2.
 * Intents: Guilds, GuildMessages, GuildMembers, GuildMessageReactions, MessageContent,
 *          DirectMessages, GuildModeration, GuildVoiceStates.
 * Partials: Message, Channel, Reaction, GuildMember, User.
 */
export function createClient(): Client {
  return new Client({ intents: INTENTS, partials: PARTIALS });
}
