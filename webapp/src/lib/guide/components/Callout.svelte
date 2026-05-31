<script lang="ts">
import type { Snippet } from "svelte";

// Inline doc aside. HyvUI's Alert is for form errors; this is for guidance.
// Colors come from tokens so callouts survive theme switches.
interface Props {
  variant?: "tip" | "note" | "warning";
  children: Snippet;
}
const { variant = "note", children }: Props = $props();
const label = $derived({ tip: "tip", note: "note", warning: "heads up" }[variant]);
</script>

<aside class="callout {variant}">
  <span class="tag">{label}</span>
  <div class="body">{@render children()}</div>
</aside>

<style>
  .callout {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--space-sm);
    align-items: start;
    padding: var(--space-sm) var(--space-md);
    border: 1px solid var(--line);
    border-left-width: 3px;
    border-radius: var(--radius-sm);
    background: var(--bg-elev-soft);
  }
  .tag {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-soft);
  }
  .body { font-size: 0.92rem; line-height: 1.5; color: var(--text); }
  .body :global(p) { margin: 0; }
  .tip { border-left-color: var(--accent); }
  .tip .tag { color: var(--accent); }
  .note { border-left-color: var(--signal); }
  .note .tag { color: var(--signal); }
  .warning { border-left-color: var(--status-warn); }
  .warning .tag { color: var(--status-warn); }
</style>
