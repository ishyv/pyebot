<script lang="ts">
import { PageHeader, Stack } from "@hyvnt/hyvui";
import Callout from "$lib/guide/components/Callout.svelte";
import Steps from "$lib/guide/components/Steps.svelte";
import { groupTopicsByCapability } from "$lib/guide/grouping";
import { GUIDE_TOPICS } from "$lib/guide/topics";

const groups = groupTopicsByCapability(GUIDE_TOPICS);
const topicHref = (id: string) => `/guide/${id}`;
</script>

<svelte:head><title>Guide</title></svelte:head>

<Stack gap="var(--space-lg)">
  <PageHeader
    title="guide"
    subtitle="a plain-language tour of what the bot can do before you wire it into a server."
  />

  <section class="quick-start">
    <h2>start with the shape</h2>
    <Steps steps={[
      "skim the feature groups below to see what fits your server.",
      "open a topic for commands, setup notes, and what members will actually use.",
      "after login, use the server guide to enable and configure the pieces you want.",
    ]} />
    <Callout variant="note">
      this is user-facing documentation. framework and developer notes still live
      in the project readme and technical docs.
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
  h3 {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.82rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-soft);
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
    gap: var(--space-sm);
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: var(--space-2xs);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--bg-elev-soft);
    padding: var(--space-sm) var(--space-md);
    text-decoration: none;
    transition: border-color var(--transition-fast), background var(--transition-fast);
  }
  .card:hover { border-color: var(--accent); background: var(--bg-elev); }
  .card strong { font-weight: 400; color: var(--text); font-size: 0.95rem; }
  .card span { color: var(--text-soft); font-size: 0.85rem; line-height: 1.4; }
  @media (prefers-reduced-motion: reduce) { .card { transition: none; } }
</style>
