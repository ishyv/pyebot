<script lang="ts">
import Callout from "$lib/guide/components/Callout.svelte";
import Steps from "$lib/guide/components/Steps.svelte";
</script>

<p>
  this bot brings moderation tools, economy, rpg, embeds, and more to your
  server. you pick which parts to turn on and tune them from this dashboard.
</p>

<Steps steps={[
  "enable the features you want on the features page.",
  "set your log and report channels on the channels page.",
  "open each feature's topic in this guide to learn how to use and tune it.",
]} />

<Callout variant="note">
  new here? the "commands & basics" topic explains how slash commands and the
  dashboard fit together.
</Callout>
