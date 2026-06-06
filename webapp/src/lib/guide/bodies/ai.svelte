<script lang="ts">
import Callout from "$lib/guide/components/Callout.svelte";
</script>

<p>
  the ai feature adds commands that let members ask questions, generate text, or
  run other ai-assisted tasks directly in discord. admins can also use ai
  commands to help draft announcements or moderate content.
</p>

<h2>what it is good for</h2>
<p>
  use it for lightweight questions, writing help, summary-style tasks, and
  admin drafting. keep server policy and sensitive decisions in human hands;
  outsourcing judgment to a text box is how nonsense gets a badge.
</p>

<h2>set it up</h2>
<p>
  enable the ai feature, configure an ai provider key on the bot host, then use
  /ask or the configured ai commands in discord.
</p>

<Callout variant="note">
  ai commands only work if the bot host has configured at least one ai provider
  key (anthropic, openai, or gemini). if /ask does nothing, the key is missing
  or the feature is disabled.
</Callout>
