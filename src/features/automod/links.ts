/** Shared link helpers for automod link/spam policies. */

/** Extracts http(s) URLs from message content. */
export function extractLinks(content: string): string[] {
  return content.match(/https?:\/\/[^\s>]+/gi) ?? [];
}

/** Lowercased hostname of a URL, with a best-effort fallback for malformed input. */
export function extractHostname(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return (
      rawUrl
        .replace(/^https?:\/\//i, "")
        .split(/[/?#\s]/)[0]
        ?.toLowerCase() ?? ""
    );
  }
}
