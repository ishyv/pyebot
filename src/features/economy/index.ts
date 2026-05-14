/**
 * Economy feature manifest.
 *
 * Surface:
 *   /balance /transfer /work /coinflip /trivia /rob
 *   /market-list /market-buy /market-browse /market-cancel
 *   /quest-list /quest-accept /quest-claim
 *   /inventory
 *
 * Component routes: trivia answer buttons.
 *
 * Listens to FightEnded to award currency from the RPG combat reward
 * pool (decoupled from RPG).
 */

import { defineFeature } from "@/framework";

export default defineFeature({
  id: "economy",
  name: "Economy",
  description: "Currency wallet, marketplace, daily/work rewards, quests, and minigames.",
  defaultEnabled: true,
});
