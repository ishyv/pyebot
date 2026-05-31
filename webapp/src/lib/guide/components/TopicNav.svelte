<script lang="ts">
import { groupTopicsByCapability } from "$lib/guide/grouping";
import type { GuideTopicMeta } from "$lib/guide/types";

interface Props {
  topics: readonly GuideTopicMeta[];
  guildId: string;
  /** current topic id, or null on the landing page */
  activeId: string | null;
}
const { topics, guildId, activeId }: Props = $props();
const groups = $derived(groupTopicsByCapability(topics));
const href = (id: string) => `/guilds/${guildId}/guide/${id}`;
</script>

<nav class="topic-nav" aria-label="guide topics">
  <a class="home" class:active={activeId === null} href={`/guilds/${guildId}/guide`}>overview</a>
  {#each groups as group (group.id)}
    <div class="group">
      <span class="group-label">{group.label}</span>
      {#each group.topics as topic (topic.id)}
        <a href={href(topic.id)} class:active={topic.id === activeId}>{topic.title}</a>
      {/each}
    </div>
  {/each}
</nav>

<style>
  .topic-nav { display: flex; flex-direction: column; gap: var(--space-md); font-size: 0.9rem; }
  .group { display: flex; flex-direction: column; gap: var(--space-2xs); }
  .group-label {
    font-family: var(--font-mono); font-size: 0.78rem; letter-spacing: 0.08em;
    text-transform: uppercase; color: var(--text-soft); margin-bottom: var(--space-2xs);
  }
  a {
    color: var(--text-soft); text-decoration: none; padding: var(--space-2xs) var(--space-xs);
    border-left: 2px solid transparent; border-radius: var(--radius-sm);
    transition: color var(--transition-fast), border-color var(--transition-fast), background var(--transition-fast);
  }
  a:hover { color: var(--text); background: var(--bg-elev-soft); }
  a.active { color: var(--accent); border-left-color: var(--accent); }
  .home { font-family: var(--font-mono); font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.08em; }
  @media (prefers-reduced-motion: reduce) { a { transition: none; } }
</style>
