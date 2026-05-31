<script lang="ts">
import Callout from "$lib/guide/components/Callout.svelte";
import Steps from "$lib/guide/components/Steps.svelte";
</script>

<p>
  automod watches messages in real time and acts before a moderator even sees the
  problem. it can catch spam bursts, mass mentions, and banned images and delete
  or flag them automatically.
</p>

<Steps steps={[
  "enable the automod feature on the features page.",
  "open the automod page and choose which rules to activate.",
  "set an automod log channel so you can review what was caught.",
]} />

<Callout variant="warning">
  aggressive filters can flag real members by accident. start with permissive
  thresholds and tighten them after you see what gets caught.
</Callout>
