<script lang="ts">
import { Badge, Input, PageHeader, Panel, Stack, surface } from "@hyvnt/hyvui";
import type {
  GuideBadge,
  GuideCapability,
  GuideCommand,
  GuideDashboardPage,
  GuideFeature,
  GuideRuntimeRoute,
} from "$shared/bridge-types";
import type { PageData } from "./$types";

interface Props {
  data: PageData;
}

type LaneKind = "capability" | "feature" | "command" | "runtime" | "dashboard";

type InspectorNode =
  | { kind: "capability"; value: GuideCapability }
  | { kind: "feature"; value: GuideFeature }
  | { kind: "command"; value: GuideCommand }
  | { kind: "runtime"; value: GuideRuntimeRoute }
  | { kind: "dashboard"; value: GuideDashboardPage };

const { data }: Props = $props();

let search = $state("");
let activeCapability = $state("all");
let selectedNodeId = $state<string | null>(null);

const graph = $derived(data.graph);
const featuresById = $derived(new Map(graph.features.map((feature) => [feature.id, feature])));
const capabilitiesById = $derived(
  new Map(graph.capabilities.map((capability) => [capability.id, capability])),
);
const commandsById = $derived(new Map(graph.commands.map((command) => [command.id, command])));
const runtimeRoutesById = $derived(
  new Map(graph.runtimeRoutes.map((route) => [route.id, route])),
);
const dashboardPagesById = $derived(
  new Map(graph.dashboardPages.map((page) => [page.id, page])),
);

const query = $derived(search.trim().toLowerCase());
const visibleFeatures = $derived(
  graph.features.filter((feature) => {
    if (activeCapability !== "all" && feature.capabilityId !== activeCapability) return false;
    if (!query) return true;
    return featureMatches(feature, query);
  }),
);
const visibleFeatureIds = $derived(new Set(visibleFeatures.map((feature) => feature.id)));
const visibleCapabilities = $derived(
  graph.capabilities.filter((capability) =>
    capability.featureIds.some((featureId) => visibleFeatureIds.has(featureId)),
  ),
);
const visibleCommands = $derived(
  graph.commands.filter((command) => visibleFeatureIds.has(command.featureId)),
);
const visibleRuntimeRoutes = $derived(
  graph.runtimeRoutes.filter((route) => visibleFeatureIds.has(route.featureId)),
);
const visibleDashboardPages = $derived(
  graph.dashboardPages.filter((page) => visibleFeatureIds.has(page.featureId)),
);
const selected = $derived(resolveSelectedNode(selectedNodeId));
const selectedFeatureId = $derived(resolveSelectedFeatureId(selected));
const selectedCapabilityId = $derived(resolveSelectedCapabilityId(selected));

function featureMatches(feature: GuideFeature, value: string): boolean {
  const capability = capabilitiesById.get(feature.capabilityId);
  const featureText = `${feature.name} ${feature.id} ${feature.description} ${capability?.label ?? ""}`;
  if (featureText.toLowerCase().includes(value)) return true;
  return [
    ...feature.commandIds.map((id) => commandsById.get(id)),
    ...feature.runtimeRouteIds.map((id) => runtimeRoutesById.get(id)),
    ...feature.dashboardPageIds.map((id) => dashboardPagesById.get(id)),
  ].some((entry) => entry && nodeText(entry).toLowerCase().includes(value));
}

function resolveSelectedNode(id: string | null): InspectorNode | null {
  if (!id) return null;
  const capability = capabilitiesById.get(id);
  if (capability) return { kind: "capability", value: capability };
  const feature = featuresById.get(id);
  if (feature) return { kind: "feature", value: feature };
  const command = commandsById.get(id);
  if (command) return { kind: "command", value: command };
  const runtime = runtimeRoutesById.get(id);
  if (runtime) return { kind: "runtime", value: runtime };
  const dashboard = dashboardPagesById.get(id);
  if (dashboard) return { kind: "dashboard", value: dashboard };
  return null;
}

function resolveSelectedFeatureId(node: InspectorNode | null): string | null {
  if (!node) return null;
  if (node.kind === "feature") return node.value.id;
  if (node.kind === "capability") return null;
  return node.value.featureId;
}

function resolveSelectedCapabilityId(node: InspectorNode | null): string | null {
  if (!node) return null;
  if (node.kind === "capability") return node.value.id;
  const feature = node.kind === "feature" ? node.value : featuresById.get(node.value.featureId);
  return feature?.capabilityId ?? null;
}

function nodeText(
  node: GuideCommand | GuideRuntimeRoute | GuideDashboardPage | GuideFeature | GuideCapability,
): string {
  if ("method" in node) return `${node.label} ${node.method}`;
  if ("name" in node) return `${node.name} ${node.description}`;
  return `${node.label} ${node.description}`;
}

function nodeLabel(node: InspectorNode): string {
  if (node.kind === "command") return `/${node.value.name}`;
  return "name" in node.value ? node.value.name : node.value.label;
}

function nodeDescription(node: InspectorNode): string {
  if (node.kind === "runtime") return `${runtimeKindLabel(node.value.kind)} via ${node.value.method}`;
  return node.value.description;
}

function nodeBadges(node: InspectorNode): readonly GuideBadge[] {
  if (node.kind === "capability") return [];
  return node.value.badges;
}

function runtimeKindLabel(kind: GuideRuntimeRoute["kind"]): string {
  if (kind === "discord_event") return "discord event";
  if (kind === "framework_event") return "framework event";
  return "button/select route";
}

function badgeLabel(badge: GuideBadge): string {
  return badge.replaceAll("_", " ");
}

function badgeVariant(badge: GuideBadge): "ok" | "warn" | "fail" | "accent" | "default" {
  if (badge === "enabled" || badge === "default_on") return "ok";
  if (badge === "disabled") return "fail";
  if (badge === "hidden" || badge === "admin") return "warn";
  if (badge === "dashboard") return "accent";
  return "default";
}

function isNodeActive(kind: LaneKind, id: string): boolean {
  if (!selected) return false;
  if (selectedNodeId === id) return true;
  if (kind === "capability") return selectedCapabilityId === id;
  if (kind === "feature") return selectedFeatureId === id;
  const featureId =
    kind === "command"
      ? commandsById.get(id)?.featureId
      : kind === "runtime"
        ? runtimeRoutesById.get(id)?.featureId
        : dashboardPagesById.get(id)?.featureId;
  return featureId !== undefined && featureId === selectedFeatureId;
}

function selectNode(id: string): void {
  selectedNodeId = selectedNodeId === id ? null : id;
}

function featureCommands(feature: GuideFeature): GuideCommand[] {
  return feature.commandIds.flatMap((id) => {
    const command = commandsById.get(id);
    return command ? [command] : [];
  });
}

function featureRoutes(feature: GuideFeature): GuideRuntimeRoute[] {
  return feature.runtimeRouteIds.flatMap((id) => {
    const route = runtimeRoutesById.get(id);
    return route ? [route] : [];
  });
}

function featurePages(feature: GuideFeature): GuideDashboardPage[] {
  return feature.dashboardPageIds.flatMap((id) => {
    const page = dashboardPagesById.get(id);
    return page ? [page] : [];
  });
}
</script>

<Stack gap="var(--space-lg)">
  <PageHeader
    title="guide"
    subtitle="runtime map generated from loaded bot features, commands, listeners, component routes, dashboard pages, and per-server feature state."
  />

  {#if data.loadError}
    <Panel withInset>
      <p class="error">guide graph unavailable: {data.loadError}</p>
    </Panel>
  {/if}

  <div class="guide-shell">
    <aside class="filters" use:surface={{ delay: 0 }}>
      <Panel withInset>
        {#snippet header()}
          <span class="panel-title">filters</span>
        {/snippet}
        <div class="search">
          <Input bind:value={search} placeholder="search features, commands, routes" />
        </div>
        <div class="capability-list" aria-label="capability filters">
          <button
            class:active={activeCapability === "all"}
            type="button"
            onclick={() => (activeCapability = "all")}
          >
            all
            <span>{graph.features.length}</span>
          </button>
          {#each graph.capabilities as capability (capability.id)}
            <button
              class:active={activeCapability === capability.id}
              type="button"
              onclick={() => (activeCapability = capability.id)}
            >
              {capability.label}
              <span>{capability.featureIds.length}</span>
            </button>
          {/each}
        </div>
      </Panel>
    </aside>

    <section class="graph" use:surface={{ delay: 70 }} aria-label="runtime guide graph">
      <div class="lane">
        <header>
          <span>capability</span>
          <small>{visibleCapabilities.length}</small>
        </header>
        <div class="nodes">
          {#each visibleCapabilities as capability (capability.id)}
            <button
              type="button"
              class="node capability"
              class:active={isNodeActive("capability", capability.id)}
              onclick={() => selectNode(capability.id)}
            >
              <strong>{capability.label}</strong>
              <span>{capability.featureIds.length} features</span>
            </button>
          {/each}
        </div>
      </div>

      <div class="lane">
        <header>
          <span>feature</span>
          <small>{visibleFeatures.length}</small>
        </header>
        <div class="nodes">
          {#each visibleFeatures as feature (feature.id)}
            <button
              type="button"
              class="node"
              class:active={isNodeActive("feature", feature.id)}
              onclick={() => selectNode(feature.id)}
            >
              <strong>{feature.name}</strong>
              <span>{feature.description}</span>
              <span class="badges">
                {#each feature.badges as badge}
                  <Badge variant={badgeVariant(badge)}>{badgeLabel(badge)}</Badge>
                {/each}
              </span>
            </button>
          {/each}
        </div>
      </div>

      <div class="lane">
        <header>
          <span>entrypoints</span>
          <small>{visibleCommands.length}</small>
        </header>
        <div class="nodes">
          {#each visibleCommands as command (command.id)}
            <button
              type="button"
              class="node"
              class:active={isNodeActive("command", command.id)}
              onclick={() => selectNode(command.id)}
            >
              <strong>/{command.name}</strong>
              <span>{command.description}</span>
              <span class="badges">
                {#each command.badges as badge}
                  <Badge variant={badgeVariant(badge)}>{badgeLabel(badge)}</Badge>
                {/each}
              </span>
            </button>
          {/each}
        </div>
      </div>

      <div class="lane">
        <header>
          <span>runtime</span>
          <small>{visibleRuntimeRoutes.length}</small>
        </header>
        <div class="nodes">
          {#each visibleRuntimeRoutes as route (route.id)}
            <button
              type="button"
              class="node"
              class:active={isNodeActive("runtime", route.id)}
              onclick={() => selectNode(route.id)}
            >
              <strong>{route.label}</strong>
              <span>{runtimeKindLabel(route.kind)} -> {route.method}</span>
              <span class="badges">
                {#each route.badges as badge}
                  <Badge variant={badgeVariant(badge)}>{badgeLabel(badge)}</Badge>
                {/each}
              </span>
            </button>
          {/each}
        </div>
      </div>

      <div class="lane">
        <header>
          <span>state / dashboard</span>
          <small>{visibleDashboardPages.length}</small>
        </header>
        <div class="nodes">
          {#each visibleDashboardPages as page (page.id)}
            <button
              type="button"
              class="node"
              class:active={isNodeActive("dashboard", page.id)}
              onclick={() => selectNode(page.id)}
            >
              <strong>{page.label}</strong>
              <span>{page.description}</span>
              <span class="badges">
                {#each page.badges as badge}
                  <Badge variant={badgeVariant(badge)}>{badgeLabel(badge)}</Badge>
                {/each}
              </span>
            </button>
          {/each}
        </div>
      </div>
    </section>

    <aside class="inspector" use:surface={{ delay: 140 }}>
      <Panel withInset>
        {#snippet header()}
          <span class="panel-title">inspector</span>
        {/snippet}
        {#if selected}
          <div class="inspect-head">
            <span>{selected.kind}</span>
            <h2>{nodeLabel(selected)}</h2>
            <p>{nodeDescription(selected)}</p>
            {#if nodeBadges(selected).length > 0}
              <div class="inspect-badges">
                {#each nodeBadges(selected) as badge}
                  <Badge variant={badgeVariant(badge)}>{badgeLabel(badge)}</Badge>
                {/each}
              </div>
            {/if}
          </div>

          {#if selected.kind === "capability"}
            <div class="inspect-section">
              <h3>features</h3>
              {#each selected.value.featureIds as featureId}
                {@const feature = featuresById.get(featureId)}
                {#if feature}
                  <button type="button" onclick={() => selectNode(feature.id)}>{feature.name}</button>
                {/if}
              {/each}
            </div>
          {:else}
            {@const feature =
              selected.kind === "feature" ? selected.value : featuresById.get(selected.value.featureId)}
            {#if feature}
              <div class="inspect-section">
                <h3>feature</h3>
                <button type="button" onclick={() => selectNode(feature.id)}>{feature.name}</button>
              </div>
              <div class="inspect-section">
                <h3>commands</h3>
                {#each featureCommands(feature) as command}
                  <button type="button" onclick={() => selectNode(command.id)}>/{command.name}</button>
                {:else}
                  <p>no command entrypoints</p>
                {/each}
              </div>
              <div class="inspect-section">
                <h3>runtime</h3>
                {#each featureRoutes(feature) as route}
                  <button type="button" onclick={() => selectNode(route.id)}>{route.label}</button>
                {:else}
                  <p>no passive or component runtime routes</p>
                {/each}
              </div>
              <div class="inspect-section">
                <h3>dashboard</h3>
                {#each featurePages(feature) as page}
                  <a href={`/guilds/${data.guild.id}${page.path}`}>{page.label}</a>
                {:else}
                  <p>no dashboard page declared</p>
                {/each}
              </div>
            {/if}
            {#if selected.kind === "command" && selected.value.args.length > 0}
              <div class="inspect-section">
                <h3>arguments</h3>
                {#each selected.value.args as arg}
                  <p><strong>{arg.name}</strong> - {arg.description}{arg.required ? " *" : ""}</p>
                {/each}
              </div>
            {/if}
          {/if}
        {:else}
          <div class="empty-inspector">
            <h2>select a node</h2>
            <p>click any lane item to see its owner, related surfaces, and command arguments.</p>
          </div>
        {/if}
      </Panel>
    </aside>
  </div>
</Stack>

<style>
  .guide-shell {
    display: grid;
    grid-template-columns: 16rem minmax(0, 1fr) 20rem;
    gap: var(--space-md);
    align-items: start;
  }

  .filters,
  .inspector {
    position: sticky;
    top: var(--space-md);
  }

  .panel-title {
    font-family: var(--font-mono);
    font-size: 0.82rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--text-soft);
  }

  .search {
    margin-bottom: var(--space-md);
  }

  .capability-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .capability-list button,
  .inspect-section button,
  .inspect-section a {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    border: 1px solid var(--line);
    background: var(--bg-elev-soft);
    color: var(--text);
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--radius-sm);
    text-align: left;
    transition:
      border-color var(--transition-fast),
      background var(--transition-fast);
  }

  .capability-list button.active,
  .capability-list button:hover,
  .inspect-section button:hover,
  .inspect-section a:hover {
    border-color: var(--accent);
    background: var(--bg-elev);
  }

  .graph {
    display: grid;
    grid-template-columns: repeat(5, minmax(12rem, 1fr));
    gap: var(--space-sm);
    min-width: 0;
    overflow-x: auto;
    padding-bottom: var(--space-xs);
  }

  .lane {
    min-width: 12rem;
    border: 1px solid var(--line);
    background: var(--bg-elev-soft);
    border-radius: var(--radius-md);
    padding: var(--space-sm);
  }

  .lane header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-sm);
    margin-bottom: var(--space-sm);
    color: var(--text-soft);
    font-family: var(--font-mono);
    font-size: 0.76rem;
    text-transform: uppercase;
  }

  .nodes {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .node {
    position: relative;
    width: 100%;
    min-height: 6.25rem;
    display: flex;
    flex-direction: column;
    gap: var(--space-2xs);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--bg-elev);
    color: var(--text);
    padding: var(--space-sm);
    text-align: left;
    overflow: hidden;
    transition:
      border-color var(--transition-fast),
      box-shadow var(--transition-fast),
      transform var(--transition-fast);
  }

  .node::after {
    content: "";
    position: absolute;
    inset-block: 0;
    right: -1px;
    width: 3px;
    background: transparent;
  }

  .node:hover,
  .node.active {
    border-color: var(--accent);
    box-shadow: var(--shadow-card);
  }

  .node.active::after {
    background: var(--accent);
  }

  .node strong {
    font-size: 0.92rem;
    line-height: 1.25;
  }

  .node span:not(.badges) {
    color: var(--text-soft);
    font-size: 0.78rem;
    line-height: 1.35;
  }

  .badges,
  .inspect-badges {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2xs);
    margin-top: auto;
  }

  .inspect-head {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    margin-bottom: var(--space-md);
  }

  .inspect-head > span {
    color: var(--text-soft);
    font-family: var(--font-mono);
    font-size: 0.76rem;
    text-transform: uppercase;
  }

  .inspect-head h2,
  .empty-inspector h2 {
    margin: 0;
    font-size: 1.1rem;
    line-height: 1.25;
  }

  .inspect-head p,
  .empty-inspector p,
  .inspect-section p,
  .error {
    margin: 0;
    color: var(--text-soft);
    font-size: 0.86rem;
    line-height: 1.45;
  }

  .inspect-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    padding-top: var(--space-md);
    border-top: 1px solid var(--line);
    margin-top: var(--space-md);
  }

  .inspect-section h3 {
    margin: 0;
    color: var(--text-soft);
    font-family: var(--font-mono);
    font-size: 0.74rem;
    text-transform: uppercase;
  }

  .empty-inspector {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  @media (max-width: 1180px) {
    .guide-shell {
      grid-template-columns: 1fr;
    }

    .filters,
    .inspector {
      position: static;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .node,
    .capability-list button,
    .inspect-section button,
    .inspect-section a {
      transition: none;
    }
  }
</style>
