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
  warn, mute, kick, ban, restrict, quarantine, purge messages, add private notes,
  and review case history. each action records the reason, moderator, target
  member, and case state so your staff are not arguing from memory.
</p>

<h2>set it up</h2>
<Steps steps={[
  "pick a moderation log channel on the channels page.",
  "confirm staff roles and role hierarchy before using role-changing actions.",
  "open the moderation page to see cases as they arrive.",
  "review appeals and resolve or uphold each case.",
]} />

<h2>common commands</h2>
<p>
  use /warn for light intervention, /mute or /restrict when someone needs a
  cooldown, /ban or /kick for removal, and /case when staff need to inspect one
  record.
</p>
