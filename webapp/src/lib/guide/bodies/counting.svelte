<script lang="ts">
import Callout from "$lib/guide/components/Callout.svelte";
import Steps from "$lib/guide/components/Steps.svelte";
</script>

<p>
  counting is a shared game where members take turns posting the next number in
  sequence. the bot tracks the current count and the server's best streak, and
  resets if someone breaks the chain.
</p>

<h2>set it up</h2>
<Steps steps={[
  "enable the counting feature on the features page.",
  "choose one counting channel on the channels page.",
  "tell members to post only the next number there.",
]} />

<Callout variant="note">
  counting works best in one dedicated channel. letting normal chat mix with the
  count is how streaks go to die.
</Callout>
