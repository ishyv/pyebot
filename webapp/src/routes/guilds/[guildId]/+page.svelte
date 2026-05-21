<script lang="ts">
import { Grid, MetricCard, PageHeader, Panel, StatusDot, surface } from "@hyvnt/hyvui";
import EventFeed from "$lib/components/EventFeed.svelte";
import type { PageData } from "./$types";

interface Props {
  data: PageData & {
    guild: {
      id: string;
      name: string;
      iconUrl: string | null;
      memberCount: number;
      enabledFeatures: readonly string[];
    };
  };
}

const { data }: Props = $props();
const enabledCount = $derived(data.features.filter((f) => f.enabled).length);
</script>

<div class="overview">
  <PageHeader
    title={data.guild.name.toLowerCase()}
    subtitle="server overview, live status, and recent activity"
  />

  <!-- 2-column dashboard on ≥80rem viewports: metrics+future-widgets on the
       left, live activity on the right. Below 80rem they stack. -->
  <div class="dashboard">
    <div class="dashboard-main">
      <Grid minColWidth="14rem" maxCols={3} gap="var(--space-md)">
        <div use:surface={{ delay: 0 }}>
          <MetricCard label="members" value={data.guild.memberCount.toLocaleString()} trend="neutral" />
        </div>
        <div use:surface={{ delay: 60 }}>
          <MetricCard
            label="features enabled"
            value={`${enabledCount} / ${data.features.length}`}
            trend={enabledCount > 0 ? "up" : "neutral"}
          />
        </div>
        <div use:surface={{ delay: 120 }}>
          <MetricCard label="bot status" value="online" trend="up" />
        </div>
      </Grid>
    </div>

    <div class="dashboard-side">
      <Panel withInset>
        {#snippet header()}
          <div class="panel-head">
            <StatusDot status="ok" pulse />
            <span class="panel-title">live activity</span>
          </div>
        {/snippet}
        <EventFeed guildId={data.guild.id} />
      </Panel>
    </div>
  </div>
</div>

<style>
  .overview {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  /* Two-column layout: metric blocks on the left (2fr), live activity on the
     right (1fr), only when there's space. Below 80rem we stack vertically
     so the activity feed gets full width on smaller windows. */
  .dashboard {
    display: grid;
    gap: var(--space-lg);
    grid-template-columns: 1fr;
  }
  @media (min-width: 80rem) {
    .dashboard {
      grid-template-columns: 2fr 1fr;
      align-items: start;
    }
  }
  .dashboard-main, .dashboard-side { min-width: 0; }

  .panel-head { display: flex; align-items: center; gap: var(--space-sm); }
  .panel-title {
    font-family: var(--font-mono);
    font-size: 0.82rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--text-soft);
  }
</style>
