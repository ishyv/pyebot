<script lang="ts">
/**
 * Approximate Discord embed card rendered from live editor state.
 *
 * Fidelity is intentionally partial: inline markdown is limited to bold,
 * italic, inline code, and links; mentions, emoji, and `script` output are NOT
 * resolved (the script runs server-side at send time). The goal is a faithful
 * shape and accent, not a pixel-perfect Discord clone.
 */
interface PreviewField {
  name: string;
  value: string;
  inline: boolean;
}

interface Props {
  title: string | null;
  description: string | null;
  color: number | null;
  url: string | null;
  thumbnail: string | null;
  image: string | null;
  authorName: string | null;
  authorIconUrl: string | null;
  authorUrl: string | null;
  footerText: string | null;
  footerIconUrl: string | null;
  fields: readonly PreviewField[];
}

const props: Props = $props();

const accent = $derived(
  props.color === null
    ? "var(--line-strong, var(--line))"
    : `#${(props.color >>> 0).toString(16).padStart(6, "0").slice(-6)}`,
);

const isEmpty = $derived(
  !props.title &&
    !props.description &&
    !props.authorName &&
    !props.footerText &&
    !props.image &&
    !props.thumbnail &&
    props.fields.length === 0,
);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Escape first, then apply a small safe markdown subset. Output is injected with
// {@html}; because we escape before formatting, no raw user HTML can survive.
function inlineMarkdown(value: string): string {
  let html = escapeHtml(value);
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, label, href) => {
    const safeHref = String(href).replace(/"/g, "%22");
    return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/\n/g, "<br />");
  return html;
}
</script>

<div class="preview">
  {#if isEmpty}
    <p class="placeholder">nothing to preview yet. fill in the fields on the left.</p>
  {:else}
    <div class="embed" style={`border-left-color: ${accent};`}>
      <div class="embed-body">
        <div class="embed-content">
          {#if props.authorName}
            <div class="author">
              {#if props.authorIconUrl}
                <img class="author-icon" src={props.authorIconUrl} alt="" />
              {/if}
              {#if props.authorUrl}
                <a href={props.authorUrl} target="_blank" rel="noopener noreferrer">
                  {props.authorName}
                </a>
              {:else}
                <span>{props.authorName}</span>
              {/if}
            </div>
          {/if}

          {#if props.title}
            <div class="title">
              {#if props.url}
                <a href={props.url} target="_blank" rel="noopener noreferrer">{props.title}</a>
              {:else}
                {props.title}
              {/if}
            </div>
          {/if}

          {#if props.description}
            <!-- escaped + limited markdown, see inlineMarkdown -->
            <div class="description">{@html inlineMarkdown(props.description)}</div>
          {/if}

          {#if props.fields.length > 0}
            <div class="fields">
              {#each props.fields as field, i (i)}
                <div class="field" class:inline={field.inline}>
                  {#if field.name}<div class="field-name">{@html inlineMarkdown(field.name)}</div>{/if}
                  {#if field.value}<div class="field-value">{@html inlineMarkdown(field.value)}</div>{/if}
                </div>
              {/each}
            </div>
          {/if}

          {#if props.image}
            <img class="image" src={props.image} alt="" />
          {/if}
        </div>

        {#if props.thumbnail}
          <img class="thumbnail" src={props.thumbnail} alt="" />
        {/if}
      </div>

      {#if props.footerText}
        <div class="footer">
          {#if props.footerIconUrl}<img class="footer-icon" src={props.footerIconUrl} alt="" />{/if}
          <span>{props.footerText}</span>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .preview {
    position: sticky;
    top: var(--space-md);
  }
  .placeholder {
    margin: 0;
    color: var(--text-soft);
    font-family: var(--font-body);
    font-size: 0.95rem;
  }
  .embed {
    background: var(--bg-elev);
    border: 1px solid var(--line);
    border-left: 4px solid var(--line);
    border-radius: var(--radius-md);
    padding: var(--space-sm) var(--space-md);
    max-width: 32rem;
    font-family: var(--font-body);
    color: var(--text);
  }
  .embed-body {
    display: flex;
    gap: var(--space-sm);
    justify-content: space-between;
  }
  .embed-content {
    min-width: 0;
    flex: 1;
  }
  .author {
    display: flex;
    align-items: center;
    gap: var(--space-2xs);
    font-size: 0.85rem;
    margin-bottom: var(--space-2xs);
  }
  .author-icon {
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 50%;
  }
  .title {
    font-size: 1.05rem;
    margin-bottom: var(--space-2xs);
    color: var(--text);
  }
  .title a,
  .author a {
    color: var(--accent);
    text-decoration: none;
  }
  .description {
    font-size: 0.95rem;
    line-height: 1.5;
    color: var(--text-soft);
    white-space: pre-wrap;
    word-wrap: break-word;
  }
  .description :global(a) {
    color: var(--accent);
  }
  .description :global(code),
  .field-value :global(code) {
    font-family: var(--font-mono);
    font-size: 0.85em;
    background: var(--bg-elev-soft);
    padding: 0.05rem 0.3rem;
    border-radius: var(--radius-sm);
  }
  .fields {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
    margin-top: var(--space-sm);
  }
  .field {
    flex: 1 1 100%;
    min-width: 0;
  }
  .field.inline {
    flex: 1 1 30%;
  }
  .field-name {
    font-size: 0.85rem;
    color: var(--text);
    margin-bottom: 0.1rem;
  }
  .field-value {
    font-size: 0.9rem;
    color: var(--text-soft);
    white-space: pre-wrap;
    word-wrap: break-word;
  }
  .image {
    margin-top: var(--space-sm);
    max-width: 100%;
    border-radius: var(--radius-md);
  }
  .thumbnail {
    width: 5rem;
    height: 5rem;
    object-fit: cover;
    border-radius: var(--radius-md);
    flex-shrink: 0;
  }
  .footer {
    display: flex;
    align-items: center;
    gap: var(--space-2xs);
    margin-top: var(--space-sm);
    font-size: 0.8rem;
    color: var(--text-soft);
  }
  .footer-icon {
    width: 1.1rem;
    height: 1.1rem;
    border-radius: 50%;
  }
</style>
