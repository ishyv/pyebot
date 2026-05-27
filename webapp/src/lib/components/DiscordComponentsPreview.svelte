<script lang="ts">
/**
 * Approximate render of a Discord "Components V2" message from the normalized
 * tree produced by $lib/discord-preview/parse. Fidelity goal matches
 * EmbedPreview: faithful shape, hierarchy, and semantic accent, not a
 * pixel-perfect Discord clone. Button colors use HyvUI status/accent tokens
 * (semantic), not Discord's literal brand hex, per the webapp design law.
 */
import { renderMarkdown } from "$lib/discord-preview/markdown";
import type { PreviewButton, PreviewNode } from "$lib/discord-preview/types";

interface Props {
  nodes: readonly PreviewNode[];
}
const { nodes }: Props = $props();
</script>

{#snippet button(b: PreviewButton)}
  <span class="btn btn-{b.variant}" class:disabled={b.disabled}>
    {b.label}{#if b.url}<span class="ext"> ↗</span>{/if}
  </span>
{/snippet}

{#snippet node(n: PreviewNode)}
  {#if n.kind === "container"}
    <div class="container" style={n.accent ? `border-left-color: ${n.accent};` : ""}>
      {#each n.children as child, i (i)}{@render node(child)}{/each}
    </div>
  {:else if n.kind === "text"}
    <!-- escaped + block markdown (headings/subtext/bullets), see markdown.ts -->
    <div class="text">{@html renderMarkdown(n.content)}</div>
  {:else if n.kind === "separator"}
    <div class="sep" class:divider={n.divider} class:large={n.large}></div>
  {:else if n.kind === "section"}
    <div class="section">
      <div class="section-body">
        {#each n.children as child, i (i)}{@render node(child)}{/each}
      </div>
      {#if n.accessory && "variant" in n.accessory}
        {@render button(n.accessory)}
      {:else if n.accessory}
        <img class="thumb" src={n.accessory.url} alt={n.accessory.alt ?? ""} />
      {/if}
    </div>
  {:else if n.kind === "actionRow"}
    <div class="row">{#each n.children as child, i (i)}{@render node(child)}{/each}</div>
  {:else if n.kind === "button"}
    {@render button(n)}
  {:else if n.kind === "select"}
    <div class="select" class:disabled={n.disabled}>
      <span>{n.placeholder ?? "make a selection"}</span>
      <span class="caret">▾</span>
    </div>
  {:else if n.kind === "thumbnail"}
    <img class="thumb" src={n.url} alt={n.alt ?? ""} />
  {:else if n.kind === "media"}
    <div class="media">
      {#each n.items as item, i (i)}<img src={item.url} alt={item.alt ?? ""} />{/each}
    </div>
  {:else}
    <div class="unknown">unsupported component (type {n.typeId})</div>
  {/if}
{/snippet}

<div class="message">
  {#if nodes.length === 0}
    <p class="placeholder">nothing to preview yet. paste a payload on the left.</p>
  {:else}
    {#each nodes as n, i (i)}{@render node(n)}{/each}
  {/if}
</div>

<style>
  .message {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    font-family: var(--font-body);
    color: var(--text);
    max-width: 34rem;
  }
  .placeholder {
    margin: 0;
    color: var(--text-soft);
    font-size: 0.95rem;
  }
  .container {
    background: var(--bg-elev);
    border: 1px solid var(--line);
    border-left: 4px solid var(--line);
    border-radius: var(--radius-md);
    padding: var(--space-sm) var(--space-md);
    display: flex;
    flex-direction: column;
    gap: var(--space-2xs);
  }
  .text {
    font-size: 0.95rem;
    line-height: 1.5;
    color: var(--text-soft);
    word-wrap: break-word;
  }
  .text :global(a) {
    color: var(--accent);
  }
  /* Discord block markdown: hierarchy by size + color (no weight change). */
  .text :global(.md-h1) {
    font-size: 1.2rem;
    color: var(--text);
    margin: 0.15rem 0;
  }
  .text :global(.md-h2) {
    font-size: 1.05rem;
    color: var(--text);
    margin: 0.12rem 0;
  }
  .text :global(.md-h3) {
    font-size: 0.98rem;
    color: var(--text);
    margin: 0.1rem 0;
  }
  .text :global(.md-sub) {
    font-size: 0.8rem;
    color: var(--text-soft);
  }
  .text :global(.md-li) {
    padding-left: 0.6rem;
    text-indent: -0.4rem;
  }
  .text :global(.md-li)::before {
    content: "• ";
  }
  .text :global(.md-blank) {
    height: 0.5rem;
  }
  .text :global(code) {
    font-family: var(--font-mono);
    font-size: 0.85em;
    background: var(--bg-elev-soft);
    padding: 0.05rem 0.3rem;
    border-radius: var(--radius-sm);
  }
  .sep {
    height: 1px;
    margin: var(--space-2xs) 0;
  }
  .sep.divider {
    background: var(--line);
  }
  .sep.large {
    margin: var(--space-sm) 0;
  }
  .section {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-sm);
  }
  .section-body {
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-2xs);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
    margin-top: var(--space-2xs);
  }
  .btn {
    display: inline-flex;
    align-items: center;
    font-size: 0.85rem;
    padding: 0.3rem 0.7rem;
    border-radius: var(--radius-sm);
    border: 1px solid transparent;
    color: var(--text);
    background: var(--bg-elev-soft);
    white-space: nowrap;
  }
  .btn-primary {
    background: color-mix(in srgb, var(--accent) 22%, transparent);
    border-color: var(--accent);
    color: var(--accent);
  }
  .btn-success {
    background: color-mix(in srgb, var(--status-ok, var(--signal)) 22%, transparent);
    border-color: var(--status-ok, var(--signal));
    color: var(--status-ok, var(--signal));
  }
  .btn-danger {
    background: color-mix(in srgb, var(--status-fail) 18%, transparent);
    border-color: var(--status-fail);
    color: var(--status-fail);
  }
  .btn-secondary {
    border-color: var(--line);
    color: var(--text-soft);
  }
  .btn-link {
    background: none;
    color: var(--accent);
    padding-left: 0;
    padding-right: 0;
  }
  .btn.disabled {
    opacity: 0.45;
  }
  .ext {
    opacity: 0.7;
  }
  .select {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
    margin-top: var(--space-2xs);
    padding: 0.35rem 0.7rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--bg-elev-soft);
    color: var(--text-soft);
    font-size: 0.85rem;
    max-width: 20rem;
  }
  .select.disabled {
    opacity: 0.45;
  }
  .caret {
    color: var(--text-soft);
  }
  .thumb {
    width: 4.5rem;
    height: 4.5rem;
    object-fit: cover;
    border-radius: var(--radius-md);
    flex-shrink: 0;
  }
  .media {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2xs);
  }
  .media img {
    max-width: 8rem;
    border-radius: var(--radius-md);
  }
  .unknown {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--text-soft);
    border: 1px dashed var(--line);
    border-radius: var(--radius-sm);
    padding: 0.3rem 0.5rem;
  }
</style>
