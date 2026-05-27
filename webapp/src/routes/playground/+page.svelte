<script lang="ts">
import { Button, PageHeader, Panel, Stack, Textarea } from "@hyvnt/hyvui";
import DiscordComponentsPreview from "$lib/components/DiscordComponentsPreview.svelte";
import { parsePayloadJson } from "$lib/discord-preview/parse";

// A small tycoon-console-shaped payload so the preview shows something on load.
// Matches what `v2Message(...).toJSON()` emits on the bot side.
const SAMPLE = {
  flags: 1 << 15,
  components: [
    {
      type: 17,
      accent_color: 0x5865f2,
      components: [
        { type: 10, content: "# guild automated works\n⚜️ 1,240 · 🪙 8,300 · net worth 12,500" },
        { type: 14, divider: true, spacing: 1 },
        { type: 10, content: "## shift briefing\n🔧 fix bottleneck: upgrade iron works blast smelter." },
        { type: 14, divider: true, spacing: 1 },
        {
          type: 9,
          components: [
            {
              type: 10,
              content: "## 🏭 iron works  [sell → ⚜️]  👷 automated\n⛏️ lv7 18/h  🔥 lv9 24/h 🔴  🔧 lv7 30/h\nnext ×2: lv20 (+11)",
            },
          ],
          accessory: { type: 2, style: 1, label: "manage" },
        },
        {
          type: 1,
          components: [
            { type: 2, style: 1, label: "🔧 fix smelter (1,100)" },
            { type: 2, style: 3, label: "collect ready" },
            { type: 2, style: 2, label: "refresh" },
          ],
        },
        {
          type: 3,
          placeholder: "fix bottleneck...",
          options: [
            { label: "iron works — blast smelter", description: "bottleneck · lv 9 -> 10 · 1,100 coins" },
          ],
        },
      ],
    },
  ],
};

let raw = $state("");
const trimmed = $derived(raw.trim());
const result = $derived(trimmed ? parsePayloadJson(trimmed) : ({ ok: true, nodes: [] } as const));
const nodes = $derived(result.ok ? result.nodes : []);
const error = $derived(result.ok ? null : result.error);

function loadSample(): void {
  raw = JSON.stringify(SAMPLE, null, 2);
}
function clear(): void {
  raw = "";
}
</script>

<svelte:head><title>discord ui playground</title></svelte:head>

<main class="page">
  <Stack gap="var(--space-lg)">
    <div class="topline">
      <PageHeader
        title="ui playground"
        subtitle="paste a components-v2 payload to preview how it renders in discord."
      />
      <div class="topline-actions">
        <Button variant="ghost" size="sm" onclick={loadSample}>load sample</Button>
        <Button variant="ghost" size="sm" onclick={clear} disabled={!trimmed}>clear</Button>
      </div>
    </div>

    <div class="layout">
      <Panel withInset>
        {#snippet header()}<span class="panel-title">payload json</span>{/snippet}
        <Textarea
          bind:value={raw}
          rows={18}
          placeholder={"paste the output of JSON.stringify(v2Message(...)) here, or { components: [...] }"}
        />
        {#if error}
          <p class="error">{error}</p>
        {:else}
          <p class="hint">
            tip: in a test or scratch script, log
            <code>JSON.stringify(&#123; components: payload.components.map((c) =&gt; c.toJSON()) &#125;)</code>
            and paste it here.
          </p>
        {/if}
      </Panel>

      <div class="preview-col">
        <Panel>
          {#snippet header()}<span class="panel-title">preview</span>{/snippet}
          <DiscordComponentsPreview {nodes} />
        </Panel>
      </div>
    </div>
  </Stack>
</main>

<style>
  .page {
    position: relative;
    z-index: 1;
    max-width: 76rem;
    margin: 0 auto;
    padding: var(--space-lg) var(--space-md);
  }
  .topline {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-md);
  }
  .topline-actions {
    display: flex;
    gap: var(--space-xs);
  }
  .layout {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-lg);
  }
  @media (min-width: 80rem) {
    .layout {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      align-items: start;
    }
  }
  .panel-title {
    font-family: var(--font-mono);
    font-size: 0.88rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text);
  }
  .preview-col {
    position: sticky;
    top: var(--space-md);
  }
  .hint {
    margin: var(--space-sm) 0 0;
    color: var(--text-soft);
    font-size: 0.85rem;
    line-height: 1.5;
  }
  .hint code {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    background: var(--bg-elev-soft);
    padding: 0.05rem 0.3rem;
    border-radius: var(--radius-sm);
  }
  .error {
    margin: var(--space-sm) 0 0;
    color: var(--status-fail);
    font-family: var(--font-mono);
    font-size: 0.8rem;
  }
</style>
