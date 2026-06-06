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

<h2>what changes</h2>
<p>
  feature toggles are server-specific. one guild can run moderation and tickets
  only, while another runs the full economy and rpg stack. disabling a feature
  does not delete its stored history; it just stops the feature from acting.
</p>

<h2>good defaults</h2>
<p>
  start with moderation, automod, channels, and roles. add engagement features
  after staff understand where logs go and which commands members will see.
</p>

<Callout variant="note">
  changes apply right away. there is no restart or delay after toggling a
  feature.
</Callout>
