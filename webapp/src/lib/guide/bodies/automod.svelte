<script lang="ts">
import Callout from "$lib/guide/components/Callout.svelte";
import Steps from "$lib/guide/components/Steps.svelte";
</script>

<p>
  automod watches messages and automatically acts on spam, mass mentions, raids,
  and banned images, so your team does not have to catch everything by hand.
</p>

<h2>what it catches</h2>
<p>
  detectors cover repeated text, link bursts, cross-channel spam, per-user
  slowmode, mention spam, raid-like joins, and image hashes you have banned from
  the server.
</p>

<Callout variant="warning">
  strict filters can catch real members by mistake. start permissive and tighten
  the rules over time as you see what gets flagged.
</Callout>

<h2>set it up</h2>
<Steps steps={[
  "enable the automod feature on the features page.",
  "set an automod report channel so you can see what gets caught.",
  "open the automod page and choose which detectors to turn on.",
  "use /automod status after changes so staff can verify the active policy.",
]} />
