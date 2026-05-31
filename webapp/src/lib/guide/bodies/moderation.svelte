<script lang="ts">
import Callout from "$lib/guide/components/Callout.svelte";
import Steps from "$lib/guide/components/Steps.svelte";
</script>

<p>
  moderation gives you the tools to keep your server safe: warn, mute, kick, and
  ban members, then review every action as a case you can revisit or appeal.
</p>

<Callout variant="tip">
  set a moderation log channel first, so every warn, mute, and ban is recorded
  where your team can see it.
</Callout>

<h2>what you can do</h2>
<p>
  run moderation actions from discord or from this dashboard. each action opens a
  case with the reason, the moderator, and the member, so nothing gets lost.
</p>

<h2>set it up</h2>
<Steps steps={[
  "pick a moderation log channel on the channels page.",
  "open the moderation page to see cases as they arrive.",
  "review appeals and resolve or uphold each case.",
]} />
