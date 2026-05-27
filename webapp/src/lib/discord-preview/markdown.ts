/**
 * Markdown rendering for the components-v2 preview.
 *
 * Input is HTML-escaped first, then a safe subset is re-introduced as tags, so
 * no raw user HTML survives into the {@html} sink. Two entry points:
 *
 * - `inlineMarkdown` — inline only (bold/italic/code/link), newlines → <br>.
 * - `renderMarkdown` — block-aware: Discord headings (#, ##, ###), subtext (-#),
 *   bullets (-, *), and blank lines, with the inline subset applied per line.
 *   Components-V2 text displays render block markdown, which is why the console
 *   uses `## ...` and `-# ...` heavily.
 */

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Applies the inline subset to an already-escaped string. */
function formatInline(escaped: string): string {
  return escaped
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, label, href) => {
      const safeHref = String(href).replace(/"/g, "%22");
      return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    })
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/~~([^~]+)~~/g, "<s>$1</s>");
}

/** Inline-only render (escape → format → newlines to <br>). */
export function inlineMarkdown(value: string): string {
  return formatInline(escapeHtml(value)).replace(/\n/g, "<br />");
}

const inline = (line: string): string => formatInline(escapeHtml(line));

/**
 * Block-aware render. Each line becomes a block element so Discord headings and
 * subtext sit on their own line; the inline subset is applied within each.
 */
export function renderMarkdown(value: string): string {
  return value
    .split("\n")
    .map((line) => {
      const h3 = line.match(/^###\s+(.*)$/);
      if (h3) return `<div class="md md-h3">${inline(h3[1])}</div>`;
      const h2 = line.match(/^##\s+(.*)$/);
      if (h2) return `<div class="md md-h2">${inline(h2[1])}</div>`;
      const h1 = line.match(/^#\s+(.*)$/);
      if (h1) return `<div class="md md-h1">${inline(h1[1])}</div>`;
      const sub = line.match(/^-#\s+(.*)$/);
      if (sub) return `<div class="md md-sub">${inline(sub[1])}</div>`;
      const li = line.match(/^[-*]\s+(.*)$/);
      if (li) return `<div class="md md-li">${inline(li[1])}</div>`;
      if (line.trim() === "") return `<div class="md md-blank"></div>`;
      return `<div class="md md-line">${inline(line)}</div>`;
    })
    .join("");
}
