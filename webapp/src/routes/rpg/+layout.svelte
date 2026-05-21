<script lang="ts">
// Root +layout.svelte already mounts Toast (via AppShell + standalone Toast)
// and Vignette (via AppShell). No scoped chrome needed here.
import type { Snippet } from "svelte";

interface Props {
  children: Snippet;
}
const { children }: Props = $props();
</script>

{@render children()}
