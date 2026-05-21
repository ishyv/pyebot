import type { EmbedConfig, ScheduleIntervalHours } from "@/db/schemas/embed-config";
import { SCHEDULE_INTERVAL_HOURS } from "@/db/schemas/embed-config";

/** Editable embed state kept in the wizard before it is converted to a durable config. */
export type EmbedConfigDraft = Omit<
  EmbedConfig,
  | "_id"
  | "guildId"
  | "name"
  | "createdBy"
  | "createdAt"
  | "updatedAt"
  | "stickyMessageId"
  | "stickyLastResendAt"
  | "scheduledNextSendAt"
  | "scheduledLastSentAt"
>;

/** Minimal session shape needed to convert a wizard draft into a persisted config. */
export interface EmbedDraftOwner {
  readonly guildId: string;
  readonly ownerId: string;
  readonly embedName: string;
  readonly draft: EmbedConfigDraft;
}

/** Normalizes user-entered embed names into the persisted `{guildId}:{name}` key segment. */
export function parseEmbedName(raw: string): string | null {
  const name = raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 64);
  return name.length > 0 ? name : null;
}

/** Parses optional six-digit embed colors from Discord modal text input. */
export function parseEmbedColor(raw: string): number | null {
  const value = raw.trim().replace(/^#/, "");
  if (!value) return null;
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;
  return parseInt(value, 16);
}

/** Validates optional URL text from Discord modal input at the user-input boundary. */
export function parseOptionalUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  try {
    new URL(value);
    return value;
  } catch {
    return null;
  }
}

/** Narrows schedule select-menu values to the supported simple interval set. */
export function parseScheduleValue(
  raw: string,
): Pick<EmbedConfigDraft, "scheduleEnabled" | "scheduleIntervalHours"> | null {
  if (raw === "off") return { scheduleEnabled: false, scheduleIntervalHours: null };
  const hours = Number.parseInt(raw, 10);
  if (SCHEDULE_INTERVAL_HOURS.includes(hours as ScheduleIntervalHours)) {
    return { scheduleEnabled: true, scheduleIntervalHours: hours as ScheduleIntervalHours };
  }
  return null;
}

/** Creates the empty wizard state for a new embed. */
export function createBlankEmbedDraft(): EmbedConfigDraft {
  return {
    embedTitle: null,
    embedDescription: null,
    embedColor: null,
    embedUrl: null,
    embedThumbnail: null,
    embedImage: null,
    embedAuthorName: null,
    embedAuthorIconUrl: null,
    embedAuthorUrl: null,
    embedFooterText: null,
    embedFooterIconUrl: null,
    embedFields: [],
    script: null,
    scriptEnabled: false,
    channelId: null,
    scheduleEnabled: false,
    scheduleIntervalHours: null,
    stickyEnabled: false,
  };
}

/** Copies only editable fields out of a persisted config into wizard state. */
export function draftFromConfig(config: EmbedConfig): EmbedConfigDraft {
  return {
    embedTitle: config.embedTitle,
    embedDescription: config.embedDescription,
    embedColor: config.embedColor,
    embedUrl: config.embedUrl,
    embedThumbnail: config.embedThumbnail,
    embedImage: config.embedImage,
    embedAuthorName: config.embedAuthorName,
    embedAuthorIconUrl: config.embedAuthorIconUrl,
    embedAuthorUrl: config.embedAuthorUrl,
    embedFooterText: config.embedFooterText,
    embedFooterIconUrl: config.embedFooterIconUrl,
    embedFields: [...config.embedFields],
    script: config.script,
    scriptEnabled: config.scriptEnabled,
    channelId: config.channelId,
    scheduleEnabled: config.scheduleEnabled,
    scheduleIntervalHours: config.scheduleIntervalHours,
    stickyEnabled: config.stickyEnabled,
  };
}

/** Converts trusted wizard state into the durable Mongo document shape. */
export function configFromDraft(
  owner: EmbedDraftOwner,
  previous: EmbedConfig | null,
  now = new Date(),
): EmbedConfig {
  const canKeepSticky = owner.draft.stickyEnabled && previous?.channelId === owner.draft.channelId;
  const intervalMs =
    owner.draft.scheduleEnabled && owner.draft.scheduleIntervalHours
      ? owner.draft.scheduleIntervalHours * 3_600_000
      : null;

  return {
    _id: `${owner.guildId}:${owner.embedName}`,
    guildId: owner.guildId,
    name: owner.embedName,
    createdBy: previous?.createdBy ?? owner.ownerId,
    ...owner.draft,
    stickyMessageId: canKeepSticky ? (previous?.stickyMessageId ?? null) : null,
    stickyLastResendAt: canKeepSticky ? (previous?.stickyLastResendAt ?? null) : null,
    scheduledNextSendAt: intervalMs === null ? null : new Date(now.getTime() + intervalMs),
    scheduledLastSentAt: owner.draft.scheduleEnabled
      ? (previous?.scheduledLastSentAt ?? null)
      : null,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };
}
