<script lang="ts">
import { surface } from "@hyvnt/hyvui";
import type { Snippet } from "svelte";
import { page } from "$app/state";
import TopicNav from "$lib/guide/components/TopicNav.svelte";
import { GUIDE_TOPICS } from "$lib/guide/topics";
import type { LayoutData } from "./$types";

interface Props {
  data: LayoutData;
  children: Snippet;
}
const { data, children }: Props = $props();

const guildId = $derived(data.guild.id);
// active topic id from the url, or null on the guide landing page
const activeId = $derived(page.url.pathname.match(/\/guide\/([^/]+)/)?.[1] ?? null);
</script>

<div class="guide-shell">
  <aside class="toc" use:surface={{ delay: 0 }}>
    <TopicNav topics={GUIDE_TOPICS} {guildId} {activeId} />
  </aside>
  <section class="reading" use:surface={{ delay: 70 }}>
    {@render children()}
  </section>
</div>

<style>
  .guide-shell { display: grid; grid-template-columns: 12rem minmax(0, 1fr); gap: var(--space-xl); align-items: start; }
  .toc { position: sticky; top: var(--space-md); }
  .reading { min-width: 0; max-width: 48rem; }
  /* below tablet: TOC stacks above content (ui-design-notes 48rem breakpoint) */
  @media (max-width: 48rem) {
    .guide-shell { grid-template-columns: 1fr; gap: var(--space-lg); }
    .toc { position: static; }
  }
</style>
