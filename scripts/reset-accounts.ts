/**
 * Dev script — wipes all per-user gameplay data (economy, RPG, tycoon, market,
 * quests, achievements). Preserves moderation/support data (user_sanctions,
 * user_tickets), guild config (guilds), and feature toggles (guild_features).
 *
 * There is no shared "users" document — each concern is its own component
 * collection — so this clears those collections directly. (An earlier version of
 * this script targeted a `users` document and camelCase collections that never
 * existed; it was a silent no-op.)
 *
 *   bun scripts/reset-accounts.ts
 */

import "dotenv/config";
import { disconnectDb, getDb } from "../src/core/db";

// Per-user gameplay component collections. Moderation/support collections
// (user_sanctions, user_tickets) and guild documents are intentionally excluded.
const GAMEPLAY_COLLECTIONS = [
  "economy_accounts",
  "user_currencies",
  "user_inventories",
  "rpg_profiles",
  "user_factories",
  "quest_progress",
  "achievement_progress",
  "unlocked_achievements",
  "market_listings",
] as const;

async function main() {
  const db = await getDb();
  for (const name of GAMEPLAY_COLLECTIONS) {
    const result = await db.collection(name).deleteMany({});
    console.log(`[reset] ${name}: deleted ${result.deletedCount}`);
  }
  await disconnectDb();
  console.log("[reset] Done.");
}

main().catch((err) => {
  console.error("[reset] Fatal:", err);
  process.exit(1);
});
