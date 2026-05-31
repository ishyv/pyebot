/**
 * Guide content model. Metadata is pure data (drives the TOC, landing index,
 * search, and server-state wiring); the rich body for each topic is a Svelte
 * component looked up by id in `bodies.ts`.
 */

/** Capability group ids. Mirror `GUIDE_CAPABILITIES` plus a pinned "start" group. */
export type GuideGroupId =
  | "start"
  | "protection"
  | "server_ops"
  | "engagement"
  | "publishing"
  | "ai_tools";

export interface GuideTopicMeta {
  /** url slug, e.g. "moderation" */
  readonly id: string;
  /** lowercase display title */
  readonly title: string;
  /** one-line intro shown under the title and in the landing index */
  readonly summary: string;
  /** grouping bucket for the TOC */
  readonly group: GuideGroupId;
  /** loaded feature id; drives the live enabled badge. omit for non-feature topics. */
  readonly featureId?: string;
  /** dashboard path relative to the guild, e.g. "/moderation"; renders a "configure" link */
  readonly dashboardPath?: string;
  /** discord slash commands this topic covers, e.g. ["/warn"] */
  readonly discordCommands?: readonly string[];
  /** extra search terms beyond title/summary */
  readonly keywords?: readonly string[];
}

/** Ordered group with display label, produced by `groupTopicsByCapability`. */
export interface GuideTopicGroup {
  readonly id: GuideGroupId;
  /** lowercase display label */
  readonly label: string;
  readonly topics: readonly GuideTopicMeta[];
}
