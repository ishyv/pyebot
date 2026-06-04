import { ApplicationCommandOptionType } from "discord.js";
import { resolveFeatureEnabled } from "@/components/guild-features";
import {
  GUIDE_CAPABILITIES,
  GUIDE_FEATURE_METADATA,
  type GuideCapabilityId,
} from "@/core/featureGuideMetadata";
import type { LoadedFeature } from "@/framework/types";
import type {
  GuideBadge,
  GuideCommand,
  GuideCommandArg,
  GuideDashboardPage,
  GuideFeature,
  GuideGraphSnapshot,
  GuideRuntimeRoute,
} from "@/webapp/bridge-types";
import type { FeatureConfigDefinition } from "./featureConfig";

/** Feature-owned dashboard config metadata keyed by loaded feature id. */
export type FeatureConfigRegistry = Readonly<Record<string, FeatureConfigDefinition | undefined>>;

/** Inputs needed to derive a runtime capability graph without logging into Discord. */
export interface CapabilityGraphInput {
  readonly features: readonly LoadedFeature[];
  readonly configs?: FeatureConfigRegistry;
  readonly overrides?: Readonly<Record<string, boolean>>;
}

/** Command node enriched with help metadata that Discord slash JSON does not carry. */
export interface CapabilityCommand extends GuideCommand {
  readonly hints: readonly string[];
  readonly requires?: string;
}

/** Feature node enriched with internal config-presence metadata for admin selectors. */
export interface CapabilityFeature extends GuideFeature {
  readonly hasConfig: boolean;
}

/**
 * Canonical runtime capability graph.
 *
 * Public/webapp callers receive the guide-safe projection via
 * `toGuideGraphSnapshot`. Internal framework selectors also keep the loaded
 * feature objects and config definitions so help/admin surfaces do not maintain
 * parallel registries.
 */
export interface CapabilityGraphSnapshot extends Omit<GuideGraphSnapshot, "features" | "commands"> {
  readonly features: readonly CapabilityFeature[];
  readonly commands: readonly CapabilityCommand[];
  readonly loadedFeatures: readonly LoadedFeature[];
  readonly featureConfigs: ReadonlyMap<string, FeatureConfigDefinition>;
}

type SlashCommandJson = {
  readonly name?: unknown;
  readonly description?: unknown;
  readonly options?: readonly SlashCommandOptionJson[];
};

type SlashCommandOptionJson = {
  readonly type?: unknown;
  readonly name?: unknown;
  readonly description?: unknown;
  readonly required?: unknown;
  readonly options?: readonly SlashCommandOptionJson[];
};

let installedGraph: CapabilityGraphSnapshot = emptyCapabilityGraph();

/** Builds the canonical graph from loader metadata, curated labels, and config metadata. */
export function buildCapabilityGraph(input: CapabilityGraphInput): CapabilityGraphSnapshot {
  const allCommandNames = collectCommandNames(input.features);
  const capabilities = new Map<GuideCapabilityId, Set<string>>();
  const features: CapabilityFeature[] = [];
  const commands: CapabilityCommand[] = [];
  const runtimeRoutes: GuideRuntimeRoute[] = [];
  const dashboardPages: GuideDashboardPage[] = [];
  const ids = new Set<string>();
  const configs = new Map(
    Object.entries(input.configs ?? {}).flatMap(([featureId, config]) =>
      config ? [[featureId, config] as const] : [],
    ),
  );

  for (const loadedFeature of input.features) {
    const descriptor = loadedFeature.descriptor;
    const metadata = GUIDE_FEATURE_METADATA[descriptor.id];
    const capabilityId = metadata?.capabilityId ?? "other";
    const defaultEnabled = descriptor.defaultEnabled !== false;
    const enabled = resolveFeatureEnabled(descriptor, input.overrides);
    const featureBadges: GuideBadge[] = [
      enabled ? "enabled" : "disabled",
      defaultEnabled ? "default_on" : "default_off",
    ];

    const commandIds = collectCommands(loadedFeature, allCommandNames).map((command) => {
      addUniqueId(ids, command.id);
      commands.push(command);
      return command.id;
    });
    const runtimeRouteIds = collectRuntimeRoutes(loadedFeature).map((route) => {
      addUniqueId(ids, route.id);
      runtimeRoutes.push(route);
      return route.id;
    });
    const dashboardPageIds = collectDashboardPages(descriptor.id, metadata?.dashboardPages).map(
      (page) => {
        addUniqueId(ids, page.id);
        dashboardPages.push(page);
        return page.id;
      },
    );

    addUniqueId(ids, descriptor.id);
    features.push({
      id: descriptor.id,
      capabilityId,
      name: descriptor.name,
      description: descriptor.description,
      enabled,
      defaultEnabled,
      hasConfig: configs.has(descriptor.id),
      badges: featureBadges,
      commandIds,
      runtimeRouteIds,
      dashboardPageIds,
    });

    const capabilityFeatures = capabilities.get(capabilityId) ?? new Set<string>();
    capabilityFeatures.add(descriptor.id);
    capabilities.set(capabilityId, capabilityFeatures);
  }

  const graphCapabilities = Object.values(GUIDE_CAPABILITIES)
    .map((capability) => ({
      id: capability.id,
      label: capability.label,
      description: capability.description,
      featureIds: [...(capabilities.get(capability.id) ?? [])],
    }))
    .filter((capability) => capability.featureIds.length > 0);

  return {
    capabilities: graphCapabilities,
    features,
    commands,
    runtimeRoutes,
    dashboardPages,
    loadedFeatures: input.features,
    featureConfigs: configs,
  };
}

/** Installs the boot-built graph used by help, dashboard, and diagnostics selectors. */
export function installCapabilityGraph(graph: CapabilityGraphSnapshot): void {
  installedGraph = graph;
}

/** Returns the currently installed framework capability graph. */
export function getCapabilityGraph(): CapabilityGraphSnapshot {
  return installedGraph;
}

/** Converts the canonical graph to the bridge-safe guide DTO. */
export function toGuideGraphSnapshot(graph: CapabilityGraphSnapshot): GuideGraphSnapshot {
  return {
    capabilities: graph.capabilities,
    features: graph.features.map(({ hasConfig: _hasConfig, ...feature }) => feature),
    commands: graph.commands,
    runtimeRoutes: graph.runtimeRoutes,
    dashboardPages: graph.dashboardPages,
  };
}

/** Returns a config definition attached to a loaded feature, if one was declared. */
export function getCapabilityFeatureConfig(featureId: string): FeatureConfigDefinition | undefined {
  return installedGraph.featureConfigs.get(featureId);
}

/** Returns the original loaded feature records captured by the installed graph. */
export function getCapabilityLoadedFeatures(): readonly LoadedFeature[] {
  return installedGraph.loadedFeatures;
}

function collectCommandNames(features: readonly LoadedFeature[]): ReadonlySet<string> {
  const names = new Set<string>();
  for (const feature of features) {
    for (const command of feature.commands) names.add(command.data.name);
  }
  return names;
}

function collectCommands(
  feature: LoadedFeature,
  allCommandNames: ReadonlySet<string>,
): CapabilityCommand[] {
  return feature.commands.map((command) => {
    const help = command.help;
    if (help !== false && !isCommandHelpObject(help)) {
      throw new Error(`Command "${command.data.name}" must declare help metadata or help: false.`);
    }
    const hints = help === false ? [] : (help.hints ?? []);
    validateHints(command.data.name, hints, allCommandNames);

    const json = command.data.toJSON() as SlashCommandJson;
    const hidden = help === false;
    const requiresAdmin = command.requiresAdmin === true;
    const badges: GuideBadge[] = ["command"];
    if (hidden) badges.push("hidden");
    if (requiresAdmin) badges.push("admin");
    if (command.contract?.guildOnly) badges.push("guild_only");
    if (command.contract?.defer) badges.push("deferred");
    return {
      id: commandId(feature.descriptor.id, command.data.name),
      featureId: feature.descriptor.id,
      name: stringValue(json.name) ?? command.data.name,
      description: stringValue(json.description) ?? "",
      hidden,
      requiresAdmin,
      hints,
      requires: help === false ? undefined : help.requires,
      badges,
      args: collectArgs(json.options ?? []),
    };
  });
}

function collectRuntimeRoutes(feature: LoadedFeature): GuideRuntimeRoute[] {
  const featureId = feature.descriptor.id;
  const routes: GuideRuntimeRoute[] = [];
  for (const reg of feature.registrations) {
    if (reg.kind === "listen") {
      routes.push({
        id: runtimeRouteId(featureId, "discord_event", reg.event, reg.method),
        featureId,
        kind: "discord_event",
        label: reg.event,
        method: reg.method,
        badges: ["event", "passive"],
      });
    } else if (reg.kind === "event") {
      routes.push({
        id: runtimeRouteId(featureId, "framework_event", reg.ctor.name, reg.method),
        featureId,
        kind: "framework_event",
        label: reg.ctor.name,
        method: reg.method,
        badges: ["event", "passive"],
      });
    } else {
      routes.push({
        id: runtimeRouteId(featureId, "component", reg.prefix, reg.method),
        featureId,
        kind: "component",
        label: reg.prefix,
        method: reg.method,
        badges: ["component"],
      });
    }
  }
  return routes;
}

function collectDashboardPages(
  featureId: string,
  pages: readonly {
    label: string;
    path: string;
    description: string;
    badges?: readonly GuideBadge[];
  }[] = [],
): GuideDashboardPage[] {
  return pages.map((page) => ({
    id: dashboardPageId(featureId, page.path),
    featureId,
    label: page.label,
    path: page.path,
    description: page.description,
    badges: ["dashboard", ...(page.badges ?? [])],
  }));
}

function collectArgs(options: readonly SlashCommandOptionJson[]): GuideCommandArg[] {
  const args: GuideCommandArg[] = [];
  for (const option of options) {
    const name = stringValue(option.name);
    const description = stringValue(option.description);
    if (!name || !description) continue;

    if (option.type === ApplicationCommandOptionType.Subcommand) {
      args.push({ name, description, required: true });
      args.push(...collectNestedArgs(name, option.options ?? []));
      continue;
    }

    if (option.type === ApplicationCommandOptionType.SubcommandGroup) {
      args.push({ name, description, required: true });
      for (const subcommand of option.options ?? []) {
        const subName = stringValue(subcommand.name);
        if (!subName) continue;
        const prefix = `${name} ${subName}`;
        const subDescription = stringValue(subcommand.description);
        if (subDescription)
          args.push({ name: prefix, description: subDescription, required: true });
        args.push(...collectNestedArgs(prefix, subcommand.options ?? []));
      }
      continue;
    }

    args.push({
      name,
      description,
      required: option.required === true,
    });
  }
  return args;
}

function collectNestedArgs(
  prefix: string,
  options: readonly SlashCommandOptionJson[],
): GuideCommandArg[] {
  return options.flatMap((option) => {
    const name = stringValue(option.name);
    const description = stringValue(option.description);
    if (!name || !description) return [];
    return [
      {
        name: `${prefix} ${name}`,
        description,
        required: option.required === true,
      },
    ];
  });
}

function isCommandHelpObject(
  help: LoadedFeature["commands"][number]["help"] | undefined,
): help is Exclude<LoadedFeature["commands"][number]["help"], false> {
  return typeof help === "object" && help !== null;
}

function validateHints(
  commandName: string,
  hints: readonly string[],
  allCommandNames: ReadonlySet<string>,
): void {
  for (const hint of hints) {
    const hintedCommand = slashCommandName(hint);
    if (hintedCommand && !allCommandNames.has(hintedCommand)) {
      throw new Error(`Command "${commandName}" has unknown command hint "${hint}".`);
    }
  }
}

function slashCommandName(hint: string): string | null {
  const match = /^\/([a-z0-9_-]+)/i.exec(hint.trim());
  return match?.[1] ?? null;
}

function addUniqueId(ids: Set<string>, id: string): void {
  if (ids.has(id)) throw new Error(`Capability graph contains duplicate node id "${id}".`);
  ids.add(id);
}

function commandId(featureId: string, commandName: string): string {
  return `${featureId}:command:${commandName}`;
}

function runtimeRouteId(
  featureId: string,
  kind: GuideRuntimeRoute["kind"],
  label: string,
  method: string,
): string {
  return `${featureId}:${kind}:${label}:${method}`;
}

function dashboardPageId(featureId: string, path: string): string {
  return `${featureId}:dashboard:${path}`;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function emptyCapabilityGraph(): CapabilityGraphSnapshot {
  return {
    capabilities: [],
    features: [],
    commands: [],
    runtimeRoutes: [],
    dashboardPages: [],
    loadedFeatures: [],
    featureConfigs: new Map(),
  };
}
