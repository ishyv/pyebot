<script lang="ts">
import Callout from "$lib/guide/components/Callout.svelte";
</script>

<p>
  the roles page sets policies for which roles the bot is allowed to assign,
  remove, or act on. this lets you keep high-privilege roles out of the bot's
  reach even if a command targets them.
</p>

<p>
  you can also limit which roles are counted as staff so moderation commands and
  ticket helpers know who has elevated access.
</p>

<Callout variant="warning">
  the bot's own role must sit above any role it is configured to manage in your
  server's role list. discord will reject assignments where the bot's role is
  lower than the target role.
</Callout>
