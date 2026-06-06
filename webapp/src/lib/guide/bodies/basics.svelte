<script lang="ts">
import Callout from "$lib/guide/components/Callout.svelte";
import Steps from "$lib/guide/components/Steps.svelte";
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

<h2>how people use it</h2>
<Steps steps={[
  "members use slash commands in discord for everyday actions.",
  "admins use the dashboard to enable features, set channels, tune policies, and review activity.",
  "feature pages in this guide explain the command surface without exposing internal framework details.",
]} />

<h2>permissions</h2>
<p>
  discord still enforces role hierarchy and command permissions. the bot can only
  manage roles, channels, and members that discord allows it to manage.
</p>

<Callout variant="note">
  only server administrators can open this dashboard. members can use slash
  commands in discord, but cannot access any settings here.
</Callout>
