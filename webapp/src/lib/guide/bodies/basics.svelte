<script lang="ts">
import Callout from "$lib/guide/components/Callout.svelte";
</script>

<p>
  slash commands run directly in discord: type <code>/</code> to browse what the
  bot offers and pick the command you want. most features also have a dashboard
  page here where admins configure how those commands behave.
</p>

<p>
  disabling a feature on the features page hides its slash commands from members
  and stops its background handlers, so they will never see commands for
  something that is not in use.
</p>

<Callout variant="note">
  only server administrators can open this dashboard. members can use slash
  commands in discord, but cannot access any settings here.
</Callout>
