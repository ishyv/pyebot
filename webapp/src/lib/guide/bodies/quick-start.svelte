<script lang="ts">
import Callout from "$lib/guide/components/Callout.svelte";
import Steps from "$lib/guide/components/Steps.svelte";
</script>

<p>
  this bot is a bundle of server tools: moderation, automod, tickets, economy,
  rpg, embeds, ai helpers, and a few smaller utilities. admins choose which
  features fit the server instead of forcing every module onto everyone.
</p>

<h2>what to look at first</h2>
<p>
  if you are evaluating the bot, start with protection features for safety,
  server ops for setup, and engagement features for member activity. if you are
  already running it, use the dashboard guide because it shows what is enabled
  on the current server.
</p>

<h2>set it up</h2>
<Steps steps={[
  "invite the bot and log in to the dashboard with a server admin account.",
  "enable the features you want on the features page.",
  "set log, report, ticket, and game channels before turning members loose.",
  "open each feature topic to learn the commands and dashboard controls.",
]} />

<Callout variant="note">
  the public guide explains what the bot can do. the server guide adds live
  enabled badges and configure links once you pick a guild.
</Callout>
