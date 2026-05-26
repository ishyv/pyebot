import {
  buildCapabilityGraph,
  type CapabilityCommand,
  type CapabilityGraphSnapshot,
  getCapabilityGraph,
  installCapabilityGraph,
} from "@/core/capabilityGraph";
import type { FeatureDescriptor, LoadedFeature } from "@/framework";

export interface CommandArgMeta {
  readonly name: string;
  readonly description: string;
  readonly required?: boolean;
}

export interface CommandMeta {
  readonly featureId: string;
  readonly featureName: string;
  readonly name: string;
  readonly description: string;
  readonly hints: readonly string[];
  readonly requires?: string;
  readonly args: readonly CommandArgMeta[];
}

export interface FeatureCommandGroup {
  readonly feature: FeatureDescriptor;
  readonly commands: readonly CommandMeta[];
}

export interface CommandCatalog {
  readonly features: readonly FeatureCommandGroup[];
  readonly commandsByName: ReadonlyMap<string, CommandMeta>;
  readonly graph?: CapabilityGraphSnapshot;
}

/**
 * Builds the help catalog from the canonical capability graph.
 *
 * Kept as a compatibility export for older tests and callers; runtime installs
 * the graph directly through `setFeatureCatalog`.
 */
export function buildCommandCatalog(features: ReadonlyArray<LoadedFeature>): CommandCatalog {
  return commandCatalogFromGraph(buildCapabilityGraph({ features }));
}

/** Installs a catalog by installing the graph it was derived from. */
export function installCommandCatalog(catalog: CommandCatalog): void {
  if (!catalog.graph) throw new Error("Command catalog was not built from a capability graph.");
  installCapabilityGraph(catalog.graph);
}

/** Returns all feature groups with at least one command visible in `/help`. */
export function getCommandFeatures(): readonly FeatureCommandGroup[] {
  return commandCatalogFromGraph(getCapabilityGraph()).features;
}

/** Returns a formatted footer hint string, e.g. "💡 /inventory • /process • /craft". */
export function getHints(commandName: string): string {
  const meta = getCommandMeta(commandName);
  if (!meta || meta.hints.length === 0) return "";
  return `💡 ${meta.hints.join(" • ")}`;
}

/** Returns the full metadata for a command, or null if not registered. */
export function getCommandMeta(commandName: string): CommandMeta | null {
  return commandCatalogFromGraph(getCapabilityGraph()).commandsByName.get(commandName) ?? null;
}

/** Returns all visible command metadata owned by a feature. */
export function getCommandsForFeature(
  featureId: string,
): Array<{ name: string; meta: CommandMeta }> {
  const group = commandCatalogFromGraph(getCapabilityGraph()).features.find(
    (entry) => entry.feature.id === featureId,
  );
  return group?.commands.map((meta) => ({ name: meta.name, meta })) ?? [];
}

function commandCatalogFromGraph(graph: CapabilityGraphSnapshot): CommandCatalog {
  const commandsByName = new Map<string, CommandMeta>();
  const groups: FeatureCommandGroup[] = [];
  const featureById = new Map(graph.features.map((feature) => [feature.id, feature]));

  for (const feature of graph.features) {
    const commands = graph.commands
      .filter((command) => command.featureId === feature.id && !command.hidden)
      .map((command) => commandMeta(command, feature.name));

    for (const command of commands) commandsByName.set(command.name, command);
    if (commands.length > 0) {
      groups.push({
        feature: {
          id: feature.id,
          name: feature.name,
          description: feature.description,
          defaultEnabled: feature.defaultEnabled,
        },
        commands,
      });
    }
  }

  // Defensive: if a graph somehow contains a command for a missing feature, do
  // not expose it through help selectors.
  for (const command of graph.commands) {
    if (command.hidden || commandsByName.has(command.name)) continue;
    const feature = featureById.get(command.featureId);
    if (feature) commandsByName.set(command.name, commandMeta(command, feature.name));
  }

  return { features: groups, commandsByName, graph };
}

function commandMeta(command: CapabilityCommand, featureName: string): CommandMeta {
  return {
    featureId: command.featureId,
    featureName,
    name: command.name,
    description: command.description,
    hints: command.hints,
    requires: command.requires,
    args: command.args,
  };
}
