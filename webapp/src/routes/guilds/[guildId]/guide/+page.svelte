<script lang="ts">
import { PageHeader, Stack } from "@hyvnt/hyvui";
import Callout from "$lib/guide/components/Callout.svelte";
import Steps from "$lib/guide/components/Steps.svelte";
import { groupTopicsByCapability } from "$lib/guide/grouping";
import { GUIDE_TOPICS } from "$lib/guide/topics";
import type { PageData } from "./$types";

interface Props {
  data: PageData;
}
const { data }: Props = $props();
const guildId = $derived(data.guild.id);
const groups = groupTopicsByCapability(GUIDE_TOPICS);
const topicHref = (id: string) => `/guilds/${guildId}/guide/${id}`;
</script>

<svelte:head><title>Guide</title></svelte:head>

<Stack gap="var(--space-lg)">
  <PageHeader
    title="guide"
    subtitle="learn what the bot can do and how to set it up on your server."
  />

  <section class="quick-start">
    <h2>get started in three steps</h2>
    <Steps steps={[
      "turn on the features you want on the features page.",
      "set your log and report channels on the channels page.",
      "open any topic below to learn how to use and tune it.",
    ]} />
    <Callout variant="note">
      new here? start with <a href={topicHref("quick-start")}>quick start</a> and
      <a href={topicHref("basics")}>commands &amp; basics</a>.
    </Callout>
  </section>

  <section class="index">
    {#each groups as group (group.id)}
      <div class="group">
        <h3>{group.label}</h3>
        <div class="cards">
          {#each group.topics as topic (topic.id)}
            <a class="card" href={topicHref(topic.id)}>
              <strong>{topic.title}</strong>
              <span>{topic.summary}</span>
            </a>
          {/each}
        </div>
      </div>
    {/each}
  </section>
</Stack>

<style>
  .quick-start { display: flex; flex-direction: column; gap: var(--space-md); }
  h2 { margin: 0; font-size: 1.1rem; }
  .index { display: flex; flex-direction: column; gap: var(--space-lg); }
  .group { display: flex; flex-direction: column; gap: var(--space-sm); }
  h3 { margin: 0; font-family: var(--font-mono); font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-soft); }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr)); gap: var(--space-sm); }
  .card {
    display: flex; flex-direction: column; gap: var(--space-2xs);
    border: 1px solid var(--line); border-radius: var(--radius-sm);
    background: var(--bg-elev-soft); padding: var(--space-sm) var(--space-md); text-decoration: none;
    transition: border-color var(--transition-fast), background var(--transition-fast);
  }
  .card:hover { border-color: var(--accent); background: var(--bg-elev); }
  .card strong { font-weight: 400; color: var(--text); font-size: 0.95rem; }
  .card span { color: var(--text-soft); font-size: 0.85rem; line-height: 1.4; }
  @media (prefers-reduced-motion: reduce) { .card { transition: none; } }
</style>
