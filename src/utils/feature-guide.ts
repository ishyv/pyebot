import { ApplicationCommandOptionType } from "discord.js";
import { resolveFeatureEnabled } from "@/components/guild-features";
import {
  GUIDE_CAPABILITIES,
  GUIDE_FEATURE_METADATA,
  type GuideCapabilityId,
} from "@/core/featureGuideMetadata";
import { getHandleMetadata, getListenMetadata, getOnMetadata } from "@/framework/decorators";
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

export interface BuildGuideGraphInput {
  readonly features: readonly LoadedFeature[];
  readonly overrides?: Readonly<Record<string, boolean>>;
}

/** Builds the guide graph from boot-loaded runtime metadata plus small curated labels. */
export function buildGuideGraph(input: BuildGuideGraphInput): GuideGraphSnapshot {
  const capabilities = new Map<GuideCapabilityId, Set<string>>();
  const features: GuideFeature[] = [];
  const commands: GuideCommand[] = [];
  const runtimeRoutes: GuideRuntimeRoute[] = [];
  const dashboardPages: GuideDashboardPage[] = [];

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

    const commandIds = collectCommands(loadedFeature).map((command) => {
      commands.push(command);
      return command.id;
    });
    const runtimeRouteIds = collectRuntimeRoutes(loadedFeature).map((route) => {
      runtimeRoutes.push(route);
      return route.id;
    });
    const dashboardPageIds = collectDashboardPages(descriptor.id, metadata?.dashboardPages).map(
      (page) => {
        dashboardPages.push(page);
        return page.id;
      },
    );

    features.push({
      id: descriptor.id,
      capabilityId,
      name: descriptor.name,
      description: descriptor.description,
      enabled,
      defaultEnabled,
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

  return { capabilities: graphCapabilities, features, commands, runtimeRoutes, dashboardPages };
}

function collectCommands(feature: LoadedFeature): GuideCommand[] {
  return feature.commands.map((command) => {
    const json = command.data.toJSON() as SlashCommandJson;
    const hidden = command.help === false;
    const requiresAdmin = command.requiresAdmin === true;
    const badges: GuideBadge[] = ["command"];
    if (hidden) badges.push("hidden");
    if (requiresAdmin) badges.push("admin");
    return {
      id: commandId(feature.descriptor.id, command.data.name),
      featureId: feature.descriptor.id,
      name: stringValue(json.name) ?? command.data.name,
      description: stringValue(json.description) ?? "",
      hidden,
      requiresAdmin,
      badges,
      args: collectArgs(json.options ?? []),
    };
  });
}

function collectRuntimeRoutes(feature: LoadedFeature): GuideRuntimeRoute[] {
  if (!feature.handlers) return [];
  const routes: GuideRuntimeRoute[] = [];
  for (const entry of getListenMetadata(feature.handlers)) {
    routes.push({
      id: runtimeRouteId(feature.descriptor.id, "discord_event", entry.event, entry.methodKey),
      featureId: feature.descriptor.id,
      kind: "discord_event",
      label: entry.event,
      method: entry.methodKey,
      badges: ["event", "passive"],
    });
  }
  for (const entry of getOnMetadata(feature.handlers)) {
    routes.push({
      id: runtimeRouteId(
        feature.descriptor.id,
        "framework_event",
        entry.event.name,
        entry.methodKey,
      ),
      featureId: feature.descriptor.id,
      kind: "framework_event",
      label: entry.event.name,
      method: entry.methodKey,
      badges: ["event", "passive"],
    });
  }
  for (const entry of getHandleMetadata(feature.handlers)) {
    routes.push({
      id: runtimeRouteId(feature.descriptor.id, "component", entry.prefix, entry.methodKey),
      featureId: feature.descriptor.id,
      kind: "component",
      label: entry.prefix,
      method: entry.methodKey,
      badges: ["component"],
    });
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
