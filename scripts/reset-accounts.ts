/**
 * Dev script — wipes all per-user gameplay data (economy, RPG, tycoon, market,
 * quests, achievements). Preserves moderation/support data (user_sanctions,
 * user_tickets), guild config (guilds), and feature toggles (guild_features).
 *
 * Most gameplay state still lives in legacy component collections, while
 * migrated entity components live as fields on entity documents. Clear both
 * surfaces explicitly so the script stays useful during the migration window.
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
  "rpg_profiles",
  "user_factories",
  "quest_progress",
  "achievement_progress",
  "unlocked_achievements",
  "market_listings",
] as const;

const ENTITY_FIELD_RESETS = [{ collection: "users", fields: ["inventory"] }] as const;

async function main() {
  const db = await getDb();
  for (const name of GAMEPLAY_COLLECTIONS) {
    const result = await db.collection(name).deleteMany({});
    console.log(`[reset] ${name}: deleted ${result.deletedCount}`);
  }
  for (const reset of ENTITY_FIELD_RESETS) {
    const unset = Object.fromEntries(reset.fields.map((field) => [field, ""]));
    const result = await db.collection(reset.collection).updateMany({}, { $unset: unset });
    console.log(
      `[reset] ${reset.collection}: cleared ${reset.fields.join(", ")} on ${result.modifiedCount}`,
    );
  }
  await disconnectDb();
  console.log("[reset] Done.");
}

main().catch((err) => {
  console.error("[reset] Fatal:", err);
  process.exit(1);
});
