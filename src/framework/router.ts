/**
 * Component router — routes button / select-menu interactions to the
 * correct feature handler by matching the longest `@Handle("prefix:")`
 * declared across all loaded features.
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

import type {
  ButtonInteraction,
  ChannelSelectMenuInteraction,
  MentionableSelectMenuInteraction,
  ModalSubmitInteraction,
  RoleSelectMenuInteraction,
  StringSelectMenuInteraction,
  UserSelectMenuInteraction,
} from "discord.js";
import { getHandleMetadata } from "./decorators";
import type { BoundComponentHandler, Ctx, LoadedFeature } from "./types";

interface Route {
  readonly prefix: string;
  readonly featureId: string;
  readonly handler: BoundComponentHandler;
}

export class ComponentRouter {
  /** Sorted by prefix length descending so longest matches win. */
  private readonly routes: Route[] = [];

  /** Add a single route. Bootstrap uses this for the framework's own /features routes. */
  add(prefix: string, featureId: string, handler: BoundComponentHandler): void {
    this.routes.push({ prefix, featureId, handler });
    this.routes.sort((a, b) => b.prefix.length - a.prefix.length);
  }

  /** Register every @Handle method on a feature's handlers instance. */
  registerFeature(feature: LoadedFeature): void {
    if (!feature.handlers) return;
    const entries = getHandleMetadata(feature.handlers);
    for (const entry of entries) {
      const method = (feature.handlers as Record<string, unknown>)[entry.methodKey];
      if (typeof method !== "function") continue;
      const bound = (method as (...a: unknown[]) => unknown).bind(
        feature.handlers,
      ) as BoundComponentHandler;
      this.add(entry.prefix, feature.descriptor.id, bound);
    }
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

  async dispatch(
    interaction:
      | ButtonInteraction
      | StringSelectMenuInteraction
      | ChannelSelectMenuInteraction
      | MentionableSelectMenuInteraction
      | RoleSelectMenuInteraction
      | UserSelectMenuInteraction
      | ModalSubmitInteraction,
    ctx: Ctx,
  ): Promise<boolean> {
    const route = this.resolve(interaction.customId);
    if (!route) return false;
    await route.handler(interaction, ctx);
    return true;
  }
}
