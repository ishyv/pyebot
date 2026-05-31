<script lang="ts">
import Steps from "$lib/guide/components/Steps.svelte";
</script>

<p>
  channel assignments tell the bot where to post logs, reports, and managed
  messages. without these set, many features cannot notify you or your team when
  something happens.
</p>

<Steps steps={[
  "open the channels page.",
  "pick a channel for each purpose you want to use (moderation log, automod log, ticket inbox, and so on).",
  "save. the bot starts posting there immediately.",
]} />
