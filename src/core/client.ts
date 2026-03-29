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
];

export function createClient(): Client {
  return new Client({ intents: INTENTS, partials: PARTIALS });
}
