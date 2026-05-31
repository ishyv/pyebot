<script lang="ts">
import Steps from "$lib/guide/components/Steps.svelte";
</script>

<p>
  tickets let members open a private channel that only they and your designated
  helper roles can see. it keeps support conversations away from public channels
  and gives you a clean record of each request.
</p>

<Steps steps={[
  "enable the tickets feature on the features page.",
  "open the roles page and mark one or more roles as helpers.",
  "members can now run /ticket to open a private support thread.",
]} />
