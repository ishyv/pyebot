<script lang="ts">
import { surface } from "@hyvnt/hyvui";
import type { Snippet } from "svelte";
import { page } from "$app/state";
import TopicNav from "$lib/guide/components/TopicNav.svelte";
import { GUIDE_TOPICS } from "$lib/guide/topics";

interface Props {
  children: Snippet;
}
const { children }: Props = $props();

const activeId = $derived(page.url.pathname.match(/\/guide\/([^/]+)/)?.[1] ?? null);
</script>

<div class="public-guide">
  <aside class="toc" use:surface={{ delay: 0 }}>
    <TopicNav topics={GUIDE_TOPICS} basePath="/guide" {activeId} />
  </aside>
  <section class="reading" use:surface={{ delay: 70 }}>
    {@render children()}
  </section>
</div>

<style>
  .public-guide {
    width: min(72rem, calc(100% - 2rem));
    margin: 0 auto;
    padding: var(--space-xl) 0;
    display: grid;
    grid-template-columns: 12rem minmax(0, 1fr);
    gap: var(--space-xl);
    align-items: start;
    position: relative;
    z-index: 1;
  }
  .toc { position: sticky; top: var(--space-md); }
  .reading { min-width: 0; max-width: 48rem; }
  @media (max-width: 48rem) {
    .public-guide { grid-template-columns: 1fr; gap: var(--space-lg); }
    .toc { position: static; }
  }
</style>
