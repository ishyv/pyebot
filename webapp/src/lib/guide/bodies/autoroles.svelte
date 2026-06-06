<script lang="ts">
import Callout from "$lib/guide/components/Callout.svelte";
import Steps from "$lib/guide/components/Steps.svelte";
</script>

<p>
  autoroles assigns roles automatically based on a trigger you choose: give every
  new member a role when they join, let members self-assign a role by reacting to
  a message, or grant a role when a message contains certain keywords.
</p>

<h2>set it up</h2>
<Steps steps={[
  "enable the autoroles feature on the features page.",
  "check the roles page so the bot is allowed to grant the target role.",
  "use /autorole in discord to create each join, reaction, or keyword rule.",
  "test with a low-risk role before wiring member onboarding around it.",
]} />

<Callout variant="tip">
  keep onboarding autoroles simple. one clear starter role beats five overlapping
  rules that nobody remembers making.
</Callout>
