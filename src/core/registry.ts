/**
 * Feature registry.
 *
 * Holds all loaded FeatureModules and provides O(1) lookup for the dispatcher.
 * Built once during bootstrap from the feature manifest; read-only at runtime.
 *
 * Component handler lookup is a linear scan — there are only ~6 handlers and
 * their matching logic may be more complex than a simple key lookup (some
 * handlers parse the customId before deciding). Correctness over micro-perf.
 */

import type { FeatureModule, FeatureCommand, ComponentHandler } from "@/core/feature";
import { createLogger } from "@/core/logger";

const log = createLogger("registry");

export class FeatureRegistry {
  private readonly features = new Map<string, FeatureModule>();
  private readonly commandIndex = new Map<string, { feature: FeatureModule; command: FeatureCommand }>();

  register(mod: FeatureModule): void {
    if (this.features.has(mod.id)) {
      throw new Error(`Feature "${mod.id}" is already registered.`);
    }
    this.features.set(mod.id, mod);

    for (const cmd of mod.commands) {
      const name = cmd.data.name;
      if (this.commandIndex.has(name)) {
        throw new Error(`Command "${name}" is already registered (duplicate across features).`);
      }
      this.commandIndex.set(name, { feature: mod, command: cmd });
    }

    log.info(`Registered feature "${mod.id}" (${mod.commands.length} commands, ${mod.components?.length ?? 0} components, ${mod.events?.length ?? 0} events)`);
  }

  getCommand(name: string): { feature: FeatureModule; command: FeatureCommand } | undefined {
    return this.commandIndex.get(name);
  }

  /**
   * Finds the first ComponentHandler across all features whose matches() returns true.
   * Returns both the handler and its owning feature (for feature gating).
   */
  getComponentHandler(customId: string): { feature: FeatureModule; handler: ComponentHandler } | undefined {
    for (const feature of this.features.values()) {
      for (const handler of feature.components ?? []) {
        if (handler.matches(customId)) {
          return { feature, handler };
        }
      }
    }
    return undefined;
  }

  /** All command data objects for REST slash command upload. */
  allCommandData(): unknown[] {
    return [...this.commandIndex.values()].map(({ command }) => command.data.toJSON());
  }

  /** All features, in registration order. */
  allFeatures(): FeatureModule[] {
    return [...this.features.values()];
  }
}
