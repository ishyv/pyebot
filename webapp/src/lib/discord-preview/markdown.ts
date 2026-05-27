/**
 * The same limited, safe markdown subset EmbedPreview renders: bold, italic,
 * inline code, and links. Input is HTML-escaped first, then a few patterns are
 * re-introduced as tags, so no raw user HTML can survive into the {@html} sink.
 *
 * Kept as a standalone module so both the embed preview and the components-v2
 * preview render text identically (and so it can be unit-tested without Svelte).
 */

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Escape, then apply the bold/italic/code/link/newline subset. Returns HTML. */
export function inlineMarkdown(value: string): string {
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
