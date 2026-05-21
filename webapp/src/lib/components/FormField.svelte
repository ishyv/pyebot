<script lang="ts">
import { Label } from "@hyvnt/hyvui";
import type { Snippet } from "svelte";

/**
 * Unified label + description + input + error layout for forms.
 *
 * Use instead of passing label/hint/error props to Input directly so all form
 * fields (Input, Toggle, Select, custom selects) share the same visual
 * treatment. HyvUI's mono-uppercase Label gives the label its character.
 */
interface Props {
  label?: string;
  description?: string;
  error?: string;
  children: Snippet;
}

const { label, description, error, children }: Props = $props();
</script>

<div class="field" class:has-error={!!error}>
  {#if label}<Label color="muted">{label}</Label>{/if}
  {#if description}<p class="description">{description}</p>{/if}
  {@render children()}
  {#if error}<p class="error">{error}</p>{/if}
</div>

<style>
  .field {
    display: grid;
    gap: var(--space-2xs);
    margin-bottom: var(--space-sm);
  }
  .description {
    margin: 0;
    color: var(--text-soft);
    font-family: var(--font-body);
    font-size: 0.92rem;
    line-height: 1.45;
    max-width: 60ch;
  }
  .error {
    margin: var(--space-2xs) 0 0;
    color: var(--status-fail);
    font-family: var(--font-mono);
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
</style>
