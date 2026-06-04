/**
 * Component router — routes button / select-menu / modal interactions to the
 * correct handler by matching the longest route prefix across all loaded
 * features. Prefixes come from `defineRoutes` (`ns:route:`); bootstrap adds one
 * per component registration via `add`.
 *
 * Why longest-prefix-wins?
 *
 *   "market:" and "market:confirm:" should be allowed to coexist. The
 *   first matches every market button; the second is a more specific
 *   subset. Without longest-match, the order features happen to load in
 *   would silently decide which handler runs — fragile and surprising.
 *
 * The router is a simple sorted list. The number of routes is small
 * (a few dozen at most) so linear scan is fine; switching to a trie
 * would add code for no measurable benefit.
 */

import type { BoundComponentHandler } from "./types";

interface Route {
  readonly prefix: string;
  readonly featureId: string;
  readonly handler: BoundComponentHandler;
}

export class ComponentRouter {
  /** Sorted by prefix length descending so longest matches win. */
  private readonly routes: Route[] = [];

  /** Add a single route. Bootstrap adds one per component registration. */
  add(prefix: string, featureId: string, handler: BoundComponentHandler): void {
    this.routes.push({ prefix, featureId, handler });
    this.routes.sort((a, b) => b.prefix.length - a.prefix.length);
  }

  /**
   * Look up the handler for an incoming component interaction. Returns
   * null if no route matches — the caller decides what to do (typically
   * silently ignore, since stale buttons are a real-world occurrence).
   */
  resolve(customId: string): { handler: BoundComponentHandler; featureId: string } | null {
    for (const route of this.routes) {
      if (customId.startsWith(route.prefix))
        return { handler: route.handler, featureId: route.featureId };
    }
    return null;
  }
}
