<script lang="ts">
import Callout from "$lib/guide/components/Callout.svelte";
import Steps from "$lib/guide/components/Steps.svelte";
</script>

<p>
  rpg is a full progression system: members fight, gather materials, craft and
  process items, equip gear, and build up a character over time.
</p>

<p>
  most play happens in discord with commands like /fight, /gather, /craft, and
  /profile.
</p>

<h2>what members do</h2>
<p>
  members build a profile, fight other players, gather materials from locations,
  process raw drops, craft gear, equip items, and run expeditions. it is meant to
  give active members something persistent to chase between normal conversations.
</p>

<h2>set it up</h2>
<Steps steps={[
  "enable the rpg feature on the features page.",
  "open the rpg content editor if you want to tune items, recipes, locations, or actions.",
  "point members at /profile first, then /gather, /craft, and /fight.",
]} />

<Callout variant="note">
  admins can tune content, locations, and recipes in the rpg content editor.
</Callout>
