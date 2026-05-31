<script lang="ts">
import { Badge } from "@hyvnt/hyvui";
import type { Snippet } from "svelte";
import CommandRef from "$lib/guide/components/CommandRef.svelte";
import type { GuideTopicMeta } from "$lib/guide/types";

interface Props {
  topic: GuideTopicMeta;
  guildId: string;
  /** true/false when the topic has a featureId; null when it has none */
  enabled: boolean | null;
  /** previous/next topics in reading order, for footer nav */
  prev: GuideTopicMeta | null;
  next: GuideTopicMeta | null;
  children: Snippet;
}
const { topic, guildId, enabled, prev, next, children }: Props = $props();
const topicHref = (id: string) => `/guilds/${guildId}/guide/${id}`;
</script>

<article class="doc">
  <header>
    <div class="title-row">
      <h1>{topic.title}</h1>
      {#if enabled === true}
        <Badge variant="ok">active on this server</Badge>
      {:else if enabled === false}
        <a
          class="enable-link"
          href={`/guilds/${guildId}/features`}
          aria-label="not enabled, open features to enable it"
        >
          <Badge variant="warn">not enabled</Badge>
        </a>
      {/if}
    </div>
    <p class="summary">{topic.summary}</p>
  </header>

  <div class="body">{@render children()}</div>

  <footer>
    {#if topic.dashboardPath}
      <a class="configure" href={`/guilds/${guildId}${topic.dashboardPath}`}>
        configure {topic.title} on this server →
      </a>
    {/if}
    {#if topic.discordCommands && topic.discordCommands.length > 0}
      <div class="commands">
        <span class="commands-label">use it in discord</span>
        {#each topic.discordCommands as command (command)}
          <CommandRef {command} />
        {/each}
      </div>
    {/if}
    <nav class="pager" aria-label="topic navigation">
      {#if prev}<a href={topicHref(prev.id)}>← {prev.title}</a>{/if}
      {#if next}<a class="next" href={topicHref(next.id)}>{next.title} →</a>{/if}
    </nav>
  </footer>
</article>

<style>
  .doc { display: flex; flex-direction: column; gap: var(--space-lg); }
  .title-row { display: flex; align-items: center; gap: var(--space-sm); flex-wrap: wrap; }
  h1 { margin: 0; font-size: 1.4rem; line-height: 1.2; }
  .summary { margin: 0; color: var(--text-soft); font-size: 0.95rem; line-height: 1.5; }
  .enable-link { text-decoration: none; }
  .body { display: flex; flex-direction: column; gap: var(--space-md); font-size: 0.95rem; line-height: 1.6; }
  .body :global(h2) { font-size: 1.05rem; margin: var(--space-md) 0 0; }
  footer { display: flex; flex-direction: column; gap: var(--space-md); padding-top: var(--space-md); border-top: 1px solid var(--line); }
  .configure {
    align-self: flex-start; color: var(--accent); text-decoration: none;
    border: 1px solid var(--accent); border-radius: var(--radius-sm);
    padding: var(--space-xs) var(--space-md); font-size: 0.9rem;
  }
  .configure:hover { background: var(--bg-elev); }
  .commands { display: flex; flex-direction: column; gap: var(--space-xs); }
  .commands-label { font-family: var(--font-mono); font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-soft); }
  .pager { display: flex; justify-content: space-between; gap: var(--space-md); }
  .pager a { color: var(--text-soft); text-decoration: none; font-size: 0.9rem; }
  .pager a:hover { color: var(--text); }
  .pager .next { margin-left: auto; }
</style>
