/**
 * Dev script — wipes all user economy + RPG data from the database.
 * Preserves moderation data (warns, sanction_history) and guild docs.
 *
 * Usage:
 *   bun scripts/reset-accounts.ts
 *   bun scripts/reset-accounts.ts --hard   # deletes entire user documents
 */

import "dotenv/config";
import { disconnectDb, getDb } from "../src/core/db";

const HARD = process.argv.includes("--hard");

async function main() {
  const db = await getDb();

  if (HARD) {
    // Nuke every user document entirely
    const result = await db.collection("users").deleteMany({});
    console.log(`[reset] Deleted ${result.deletedCount} user documents.`);
  } else {
    // Soft reset: zero out economy + RPG, keep warns/sanctions/tickets
    const result = await db.collection("users").updateMany(
      {},
      {
        $unset: {
          economyAccount: "",
          rpgProfile: "",
          inventory: "",
          currency: "",
          minigames: "",
        },
      },
    );
    console.log(`[reset] Soft-reset ${result.modifiedCount} user documents.`);
  }

  // Also clear market listings and quests so they don't reference wiped users
  const market = await db.collection("marketListings").deleteMany({});
  console.log(`[reset] Deleted ${market.deletedCount} market listings.`);

  const quests = await db.collection("questProgress").deleteMany({});
  console.log(`[reset] Deleted ${quests.deletedCount} quest progress docs.`);

  const achievementProgress = await db.collection("achievementProgress").deleteMany({});
  const achievementUnlocks = await db.collection("achievementUnlocks").deleteMany({});
  console.log(
    `[reset] Deleted ${achievementProgress.deletedCount} achievement progress, ${achievementUnlocks.deletedCount} unlocks.`,
  );

  await disconnectDb();
  console.log("[reset] Done.");
}

main().catch((err) => {
  console.error("[reset] Fatal:", err);
  process.exit(1);
});
