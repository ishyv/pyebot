<script lang="ts">
import DocPage from "$lib/guide/components/DocPage.svelte";
import { TOPIC_BODIES } from "$lib/guide/bodies";
import type { PageData } from "./$types";

interface Props {
  data: PageData;
}
const { data }: Props = $props();

const Body = $derived(TOPIC_BODIES[data.topic.id]);
const pageTitle = $derived(
  `${data.topic.title.charAt(0).toUpperCase()}${data.topic.title.slice(1)} · Guide`,
);
</script>

<svelte:head><title>{pageTitle}</title></svelte:head>

<DocPage topic={data.topic} prev={data.prev} next={data.next}>
  <Body />
</DocPage>
