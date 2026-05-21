<script lang="ts">
import type { Snippet } from "svelte";
import { page } from "$app/state";
import GuildShell from "$lib/components/GuildShell.svelte";
import type { LayoutData } from "./$types";

interface Props {
  data: LayoutData;
  children: Snippet;
}

const { data, children }: Props = $props();
</script>

<GuildShell
  guildId={data.guild.id}
  guildName={data.guild.name}
  guildIconUrl={data.guild.iconUrl}
  activePath={page.url.pathname}
>
  {@render children()}
</GuildShell>
