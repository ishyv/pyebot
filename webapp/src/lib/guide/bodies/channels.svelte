<script lang="ts">
import Steps from "$lib/guide/components/Steps.svelte";
</script>

<p>
  channel assignments tell the bot where to post logs, reports, and managed
  messages. without these set, many features cannot notify you or your team when
  something happens.
</p>

<h2>what channels do</h2>
<p>
  moderation logs keep staff actions visible, automod reports show filtered
  messages, ticket settings decide where private support channels are created,
  and game channels keep counting or other member loops from spilling everywhere.
</p>

<Steps steps={[
  "open the channels page.",
  "pick a channel for each purpose you want to use (moderation log, automod log, ticket inbox, and so on).",
  "save. the bot starts posting there immediately.",
]} />

<p>
  for public channels, make sure members can see the messages. for staff logs,
  keep the channel private and give helper roles read access.
</p>
