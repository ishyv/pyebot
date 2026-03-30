/**
 * Fight expiry interval.
 *
 * Purpose: Periodically expire pending fight sessions that have passed their TTL.
 * Sessions are stored in the global sessions store; expired ones have expiresAt in the past.
 *
 * Call register() from index.ts to start the interval.
 */

import { sessions } from "@/core/state";
import { createLogger } from "@/core/logger";
import type { ActiveCombatSession } from "@/features/rpg/combat/engine";

const log = createLogger("fight-expiry");
const CHECK_INTERVAL_MS = 60 * 1000; // every minute
const SESSION_PREFIX = "fight:";

export function register(): void {
  setInterval(() => {
    const now = Date.now();
    let expired = 0;

    for (const [key, value] of (sessions as unknown as { map: Map<string, unknown> }).map) {
      if (!key.startsWith(SESSION_PREFIX)) continue;
      const session = value as ActiveCombatSession | undefined;
      if (!session) continue;
      if (session.status !== "pending") continue;
      if (session.expiresAt.getTime() > now) continue;

      sessions.delete(key);
      expired++;
    }

    if (expired > 0) {
      log.info(`Expired ${expired} pending fight session(s)`);
    }
  }, CHECK_INTERVAL_MS);
}
