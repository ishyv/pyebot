/**
 * Component routes for economy. The trivia answer button encodes which session
 * (user + guild) it belongs to plus the chosen option index — replacing the old
 * `trivia_answer:${user}:${guild}:${i}` string + positional split.
 */

import { defineRoutes, int, snowflake } from "@/framework";

export const routes = defineRoutes("economy", {
  // sessionKey is `${user}:${guild}`; index is the chosen option (0-3).
  trivia: { user: snowflake, guild: snowflake, index: int },
});
