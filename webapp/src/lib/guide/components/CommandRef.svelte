<script lang="ts">
// Inline /command chip + optional description. v1 takes plain strings.
interface Props {
  command: string;
  description?: string;
}
const { command, description }: Props = $props();
</script>

<div class="cmd">
  <code>{command}</code>
  {#if description}<span class="desc">{description}</span>{/if}
</div>

<style>
  .cmd { display: flex; align-items: baseline; gap: var(--space-sm); }
  code {
    font-family: var(--font-mono); font-size: 0.82rem;
    background: var(--bg-elev); border: 1px solid var(--line);
    border-radius: var(--radius-sm); padding: 0.1rem 0.4rem; color: var(--text);
  }
  .desc { font-size: 0.88rem; color: var(--text-soft); line-height: 1.4; }
</style>
