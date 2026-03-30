export type CommandMeta = {
  category: "rpg" | "economy" | "moderation" | "utility";
  description: string;
  hints: string[];
  requires?: string;
  args?: Array<{ name: string; description: string; tip?: string }>;
};

export const REGISTRY: Record<string, CommandMeta> = {
  // ── RPG ──────────────────────────────────────────────────────────────────
  "rpg-profile": {
    category: "rpg",
    description: "View your RPG stats, profession, and equipped items",
    hints: ["/gather-locations", "/fight", "/rpg-quest list"],
  },
  "gather-locations": {
    category: "rpg",
    description: "Browse gathering spots available to your profession and tool tier",
    hints: ["/gather-mine", "/gather-cutdown", "/craft"],
    args: [{ name: "type", description: "mine or forest — defaults to your profession's type" }],
  },
  "gather-mine": {
    category: "rpg",
    description: "Mine resources at a location (requires equipped pickaxe)",
    hints: ["/inventory", "/process", "/gather-locations"],
    requires: "pickaxe in weapon slot",
    args: [{ name: "location", description: "Location ID — use /gather-locations to browse", tip: "Run /gather-locations to see valid IDs for your tier" }],
  },
  "gather-cutdown": {
    category: "rpg",
    description: "Cut down trees at a location (requires equipped axe)",
    hints: ["/inventory", "/process", "/gather-locations"],
    requires: "axe in weapon slot",
    args: [{ name: "location", description: "Location ID — use /gather-locations to browse", tip: "Run /gather-locations to see valid IDs for your tier" }],
  },
  "process": {
    category: "rpg",
    description: "Process raw materials into refined ingots or planks",
    hints: ["/craft", "/inventory", "/market-list"],
    args: [
      { name: "material", description: "Raw material ID (e.g. copper_ore, oak_wood)" },
      { name: "quantity", description: "How many to process" },
    ],
  },
  "craft": {
    category: "rpg",
    description: "Craft tools from ingots — upgrades unlock higher-tier locations",
    hints: ["/equip", "/inventory", "/gather-locations"],
    args: [
      { name: "item", description: "Item to craft (e.g. stone_pickaxe, copper_axe)" },
      { name: "quantity", description: "How many to craft (default: 1)" },
    ],
  },
  "equip": {
    category: "rpg",
    description: "Equip a tool from your inventory into your weapon slot",
    hints: ["/gather-locations", "/rpg-profile", "/inventory"],
    args: [{ name: "item", description: "Item ID to equip (must be in inventory)" }],
  },
  "fight": {
    category: "rpg",
    description: "Challenge another user to a fight",
    hints: ["/rpg-profile", "/rpg-quest list", "/inventory"],
    args: [{ name: "user", description: "The user to challenge" }],
  },
  "rpg-quest": {
    category: "rpg",
    description: "Browse, accept, and claim RPG quests",
    hints: ["/rpg-profile", "/gather-locations", "/inventory"],
  },
  // ── Economy ──────────────────────────────────────────────────────────────
  "balance": {
    category: "economy",
    description: "Check your wallet balance (hand + bank)",
    hints: ["/work", "/daily", "/transfer"],
  },
  "work": {
    category: "economy",
    description: "Work a shift to earn coins (cooldown between shifts)",
    hints: ["/daily", "/coinflip", "/balance"],
  },
  "daily": {
    category: "economy",
    description: "Claim your daily login reward and build a streak",
    hints: ["/work", "/balance", "/bank deposit"],
  },
  "bank": {
    category: "economy",
    description: "Deposit, withdraw, or check your bank balance (safe from /rob)",
    hints: ["/balance", "/transfer", "/rob"],
  },
  "transfer": {
    category: "economy",
    description: "Send coins to another user",
    hints: ["/balance", "/bank"],
  },
  "inventory": {
    category: "economy",
    description: "View your collected materials and items",
    hints: ["/gather-mine", "/process", "/market-list"],
  },
  "market-list": {
    category: "economy",
    description: "Create a sell listing on the market",
    hints: ["/market-browse", "/inventory", "/balance"],
  },
  "market-browse": {
    category: "economy",
    description: "Browse active market listings",
    hints: ["/market-buy", "/market-list"],
  },
  "market-buy": {
    category: "economy",
    description: "Buy an item from the market",
    hints: ["/market-browse", "/inventory", "/balance"],
  },
  "market-cancel": {
    category: "economy",
    description: "Cancel one of your market listings",
    hints: ["/market-browse", "/market-list"],
  },
  "quest-list": {
    category: "economy",
    description: "Browse available economy quests",
    hints: ["/quest-accept", "/balance"],
  },
  "quest-accept": {
    category: "economy",
    description: "Accept an economy quest",
    hints: ["/quest-claim", "/work", "/balance"],
  },
  "quest-claim": {
    category: "economy",
    description: "Claim rewards for a completed quest",
    hints: ["/quest-list", "/balance"],
  },
  "coinflip": {
    category: "economy",
    description: "Gamble coins on a coin flip (50/50)",
    hints: ["/balance", "/work"],
  },
  "trivia": {
    category: "economy",
    description: "Answer trivia questions to earn coins",
    hints: ["/balance", "/work"],
  },
  "rob": {
    category: "economy",
    description: "Attempt to steal coins from another user's hand",
    hints: ["/bank deposit", "/balance"],
  },
  "eco-profile": {
    category: "economy",
    description: "View your economy profile — balances, status, and streak",
    hints: ["/balance", "/bank", "/work"],
  },
  // ── Moderation ────────────────────────────────────────────────────────────
  "ban": { category: "moderation", description: "Ban a user from the server", hints: ["/cases"] },
  "kick": { category: "moderation", description: "Kick a user from the server", hints: ["/cases"] },
  "mute": { category: "moderation", description: "Mute a user", hints: ["/cases"] },
  "warn": { category: "moderation", description: "Warn a user", hints: ["/cases"] },
  "cases": { category: "moderation", description: "View moderation cases", hints: [] },
  // ── Utility ───────────────────────────────────────────────────────────────
  "help": {
    category: "utility",
    description: "Browse commands by category or get help for a specific command",
    hints: [],
    args: [{ name: "topic", description: "A category (rpg, economy, moderation) or command name" }],
  },
};

export const CATEGORIES: Record<string, { label: string; emoji: string; description: string }> = {
  rpg:         { label: "RPG",         emoji: "⚔️",  description: "Gathering, crafting, combat, and progression" },
  economy:     { label: "Economy",     emoji: "💰",  description: "Coins, banking, quests, and the market" },
  moderation:  { label: "Moderation",  emoji: "🛡️",  description: "Bans, kicks, mutes, warns, and case history" },
  utility:     { label: "Utility",     emoji: "📖",  description: "Help and information commands" },
};

/** Returns a formatted footer hint string, e.g. "💡 /inventory • /process • /craft" */
export function getHints(commandName: string): string {
  const meta = REGISTRY[commandName];
  if (!meta || meta.hints.length === 0) return "";
  return "💡 " + meta.hints.join(" • ");
}

/** Returns the full metadata for a command, or null if not registered. */
export function getCommandMeta(commandName: string): CommandMeta | null {
  return REGISTRY[commandName] ?? null;
}

/** Returns all command names for a given category. */
export function getCommandsForCategory(category: string): Array<{ name: string; meta: CommandMeta }> {
  return Object.entries(REGISTRY)
    .filter(([, meta]) => meta.category === category)
    .map(([name, meta]) => ({ name, meta }));
}
