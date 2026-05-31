<script lang="ts">
import Steps from "$lib/guide/components/Steps.svelte";
</script>

<p>
  tickets let a member open a private support channel that only they and your
  helper roles can see, so questions and reports stay organized instead of
  filling up public channels.
</p>

<h2>set it up</h2>
<Steps steps={[
  "enable the tickets feature on the features page.",
  "create a category channel in discord and set it as the ticket category.",
  "give your helper roles access so they can see and reply in new tickets.",
  "members can now run /ticket to open a private support channel.",
]} />
