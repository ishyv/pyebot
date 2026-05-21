/**
 * Authorization gate for the RPG content authoring surface (/rpg and
 * /api/rpg/**). These endpoints edit the active Mongo-backed RPG content
 * snapshot used by the live bot, so they need stricter access than the
 * per-guild dashboard pages.
 *
 * Allow-list is configured via the `BOT_OWNER_IDS` env var: a
 * comma-separated list of Discord user IDs. If unset, the gate
 * fails closed (denies all requests) — there is no implicit admin.
 */
import { error } from "@sveltejs/kit";
import type { DashboardSession } from "./auth";

function parseAllowList(): readonly string[] {
  const raw = process.env.BOT_OWNER_IDS;
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Returns true iff the session's user is listed in `BOT_OWNER_IDS`. */
export function canEditRpgContent(session: DashboardSession | null): boolean {
  if (!session) return false;
  const allowed = parseAllowList();
  if (allowed.length === 0) return false; // fail-closed
  return allowed.includes(session.userId);
}

/**
 * SvelteKit guard for +page.server.ts loaders and /api/rpg/** handlers.
 * Throws a 403 if the session can't edit RPG content. Use as the first
 * line of any RPG-related load() or RequestHandler.
 */
export function requireRpgEditor(
  session: DashboardSession | null,
): asserts session is DashboardSession {
  if (!canEditRpgContent(session)) {
    throw error(403, "RPG content editing is restricted to configured bot owners.");
  }
}
