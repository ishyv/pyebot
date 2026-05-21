/**
 * Per-access-token cache of Discord's `/users/@me/guilds` response.
 *
 * Discord rate-limits this endpoint aggressively per OAuth bearer token (~1
 * req per few seconds). The dashboard hits it from many code paths per page
 * load (root layout, every page loader, SSE stream, API endpoints), so an
 * uncached approach 429s within a few clicks.
 *
 * Strategy: keep one fresh response per token for `FRESH_TTL_MS`. If a request
 * arrives while the cached entry is still fresh, return it without hitting
 * Discord. If a request arrives while the entry is stale, refetch — but on a
 * 429 (or any thrown error during refetch), fall back to the stale entry
 * instead of failing the whole request. The session loses ground-truth for at
 * most `STALE_TTL_MS`, which is fine for a permission gate.
 *
 * The cache is module-scope so it lives for the lifetime of the Node process.
 * Since the webapp runs in-process with the bot, that's the bot's lifetime.
 */

import type { DiscordUserGuild } from "./auth";
import { fetchUserGuilds } from "./discord";

const FRESH_TTL_MS = 60_000; // 1 minute — guild membership rarely changes mid-session.
const STALE_TTL_MS = 10 * 60_000; // 10 minutes — fall-back window before forcing a hard re-fetch.

interface Entry {
  guilds: DiscordUserGuild[];
  fetchedAt: number;
  inFlight: Promise<DiscordUserGuild[]> | null;
}

const cache = new Map<string, Entry>();

/**
 * Fetch the user's guilds, with cache + stale fallback.
 *
 * - If the cached entry is fresh (<FRESH_TTL_MS), return it directly.
 * - If a refetch is already in flight, await it (no thundering herd).
 * - Otherwise refetch from Discord. On success, update the cache and return.
 * - On failure, if a previous entry exists, return the stale value (so a 429
 *   blip doesn't break the whole session). Otherwise rethrow.
 */
export async function fetchUserGuildsCached(accessToken: string): Promise<DiscordUserGuild[]> {
  const now = Date.now();
  const existing = cache.get(accessToken);

  if (existing && now - existing.fetchedAt < FRESH_TTL_MS) {
    return existing.guilds;
  }
  if (existing?.inFlight) {
    return existing.inFlight;
  }

  const inFlight = (async () => {
    try {
      const guilds = await fetchUserGuilds(accessToken);
      cache.set(accessToken, { guilds, fetchedAt: Date.now(), inFlight: null });
      return guilds;
    } catch (err) {
      // 429 or any transient failure: fall back to stale cache if we have one
      // and it's within the stale window. Otherwise propagate the error.
      if (existing && now - existing.fetchedAt < STALE_TTL_MS) {
        cache.set(accessToken, { ...existing, inFlight: null });
        return existing.guilds;
      }
      cache.set(accessToken, { guilds: [], fetchedAt: 0, inFlight: null });
      throw err;
    }
  })();

  cache.set(accessToken, {
    guilds: existing?.guilds ?? [],
    fetchedAt: existing?.fetchedAt ?? 0,
    inFlight,
  });

  return inFlight;
}

/** Explicit invalidation — call after actions that change membership (rare). */
export function invalidateUserGuilds(accessToken: string): void {
  cache.delete(accessToken);
}
