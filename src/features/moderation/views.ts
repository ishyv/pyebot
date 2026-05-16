/**
 * Moderation feature views.
 *
 * Each exported function is a pure render: it takes a typed domain state and
 * returns a `v2Message`-shaped payload. No side effects, no DB or Discord
 * fetches — those happen in the caller before the render runs.
 *
 * Why colocate here rather than per-command:
 * - Multiple call sites (modlog send, case lookup, appeal review) render the
 *   same case shape. One render fn means one place to change the look.
 */

import type { SanctionHistoryEntry, SanctionType } from "@/db/schemas/user";
import type { AccentKey } from "@/ui/theme";
import { container, section, separator, text, thumb, v2Message } from "@/ui/v2";
import type { V2Payload } from "@/ui/views";
import type { ModerationResult, SanctionEntry } from "./service";

/**
 * Icon per sanction type used in list and single-case views.
 * Lives here (not glyphs.ts) because it is moderation-domain vocabulary,
 * not a generic UI glyph.
 */
const SANCTION_ICON: Record<SanctionType, string> = {
  BAN: "🔨",
  KICK: "👢",
  TIMEOUT: "🔇",
  WARN: "⚠️",
  RESTRICT: "🚫",
  PARDON: "✅",
};

/**
 * Maps a sanction type to the Container accent. Centralising this here means
 * "what colour is a ban?" has one answer the whole codebase uses.
 */
function accentForSanction(type: SanctionType): AccentKey {
  switch (type) {
    case "BAN":
    case "KICK":
      return "danger";
    case "TIMEOUT":
    case "WARN":
      return "warn";
    case "RESTRICT":
      return "info";
    case "PARDON":
      return "ok";
    default:
      return "mute";
  }
}

interface ModlogViewArgs {
  /** The result emitted by `src/features/moderation/service.ts` actions. */
  readonly result: ModerationResult;
  /** Resolved CDN URL of the target user's avatar; omit when unavailable. */
  readonly targetAvatarUrl?: string | null;
  /**
   * Optional extras the original embed surfaced as conditional fields.
   * Kept optional to preserve every existing call-site signature.
   * `note` is a freeform string used by automated actions (e.g. AutoMod evidence).
   */
  readonly extras?: {
    duration?: string;
    restrictionType?: string;
    note?: string;
  };
}

/**
 * Renders a single moderation case as a V2 message.
 *
 * Shape: one Container with the severity accent. When an avatar URL is
 * available we render a Section (heading + meta text alongside a thumbnail);
 * otherwise the same heading + meta lives as a plain TextDisplay so the layout
 * remains valid without an accessory.
 *
 * No buttons in Phase 1; the appeals workflow phase adds an `[Open case]` /
 * `[Details]` row here.
 */
export function renderModlogCase(args: ModlogViewArgs): V2Payload {
  const { result, targetAvatarUrl, extras } = args;
  const accent = accentForSanction(result.type);

  const heading = [
    `## Case #${result.caseId} — ${result.type}`,
    `**Target:** <@${result.targetId}> · \`${result.targetId}\``,
    `**Moderator:** <@${result.moderatorId}>`,
    `**Reason:** ${result.reason}`,
  ].join("\n");

  const main = targetAvatarUrl
    ? section(heading, thumb(targetAvatarUrl, `Avatar of ${result.targetTag}`))
    : text(heading);

  const extraLines: string[] = [];
  if (extras?.duration) extraLines.push(`**Duration:** ${extras.duration}`);
  if (extras?.restrictionType) extraLines.push(`**Restriction:** ${extras.restrictionType}`);
  if (extras?.note) extraLines.push(`**Note:** ${extras.note}`);
  if (result.escalated) extraLines.push("⚡ **Auto-escalated:** user timed out");

  if (extraLines.length === 0) {
    return v2Message(container(accent, main));
  }
  return v2Message(container(accent, main, separator("sm"), text(extraLines.join("\n"))));
}

/**
 * Renders a single moderation case retrieved from the database as a V2 message.
 *
 * Used by `/case view`. Entry comes from `getCaseById`; it may lack a moderatorId
 * if the record predates the case ID system.
 */
export function renderCaseView(entry: SanctionEntry, userId: string, caseId: number): V2Payload {
  const accent = accentForSanction(entry.type as SanctionType);
  const icon = SANCTION_ICON[entry.type as SanctionType] ?? "📝";
  const ts = entry.date ? `<t:${Math.floor(new Date(entry.date).getTime() / 1000)}:F>` : "Unknown";
  const lines = [
    `## Case #${caseId} — ${icon} ${entry.type}`,
    `**User:** <@${userId}>`,
    entry.moderatorId ? `**Moderator:** <@${entry.moderatorId}>` : null,
    `**Date:** ${ts}`,
    `**Reason:** ${entry.description}`,
  ]
    .filter(Boolean)
    .join("\n");
  return v2Message(container(accent, text(lines)));
}

/**
 * Renders a paginated sanction history list as a V2 message.
 *
 * Used by `/cases` (full history) and `/warn list` (warns only). Each entry
 * description is capped at 200 chars so the total stays within the 4000-char
 * V2 text budget even at the 15-entry display cap.
 */
export function renderSanctionHistory(
  targetTag: string,
  entries: SanctionHistoryEntry[],
): V2Payload {
  const lines = entries.map((e, i) => {
    const icon = SANCTION_ICON[e.type] ?? "📝";
    const ts = e.date ? `<t:${Math.floor(new Date(e.date).getTime() / 1000)}:d>` : "N/A";
    const reason = e.description.length > 200 ? `${e.description.slice(0, 200)}…` : e.description;
    return `**${i + 1}.** ${icon} **${e.type}** — ${ts}\n> ${reason}`;
  });
  return v2Message(
    container("mute", text(`## Cases — ${targetTag}`), separator("sm"), text(lines.join("\n\n"))),
  );
}

/**
 * Renders a list of moderator notes attached to a user as a V2 message.
 *
 * Used by `/note list`. Note text is capped at 200 chars per entry.
 */
export function renderNoteList(
  targetTag: string,
  notes: Array<{ note: string; moderatorId: string; createdAt: string }>,
): V2Payload {
  const lines = notes.map((n, i) => {
    const ts = `<t:${Math.floor(new Date(n.createdAt).getTime() / 1000)}:d>`;
    const note = n.note.length > 200 ? `${n.note.slice(0, 200)}…` : n.note;
    return `**${i + 1}.** ${ts} by <@${n.moderatorId}>\n> ${note}`;
  });
  return v2Message(
    container("mute", text(`## Notes — ${targetTag}`), separator("sm"), text(lines.join("\n\n"))),
  );
}
