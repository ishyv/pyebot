<script lang="ts">
import Callout from "$lib/guide/components/Callout.svelte";
</script>

<p>
  the features page is the master on/off switch for every part of the bot.
  toggle a feature off and its slash commands disappear from discord, its
  background handlers stop running, and its dashboard pages go quiet.
</p>

<p>
  use this page to keep your server lean: only enable the parts that fit how
  your community works.
</p>

<Callout variant="note">
  changes apply right away. there is no restart or delay after toggling a
  feature.
</Callout>
