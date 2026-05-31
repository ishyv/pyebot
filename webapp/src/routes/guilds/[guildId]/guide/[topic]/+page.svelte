<script lang="ts">
import DocPage from "$lib/guide/components/DocPage.svelte";
import { TOPIC_BODIES } from "$lib/guide/bodies";
import type { PageData } from "./$types";

interface Props {
  data: PageData;
}
const { data }: Props = $props();

const guildId = $derived(data.guild.id);
const Body = $derived(TOPIC_BODIES[data.topic.id]);
// enabled: true/false when the topic maps to a feature, null otherwise.
// data.featureEnabled comes from the guide layout server load.
const enabled = $derived(
  data.topic.featureId ? (data.featureEnabled[data.topic.featureId] ?? false) : null,
);
</script>

<svelte:head><title>{data.topic.title} · guide</title></svelte:head>

<DocPage topic={data.topic} {guildId} {enabled} prev={data.prev} next={data.next}>
  <Body />
</DocPage>
