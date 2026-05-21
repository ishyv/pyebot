/**
 * Form-data parsers for the embed editor.
 *
 * Shapes raw `FormData` into an `EmbedDraftDTO`. This layer only normalizes
 * types (hex -> int color, JSON -> field array, schedule select -> union); the
 * authoritative validation (per-field limits + 6000-char total) lives in
 * `EmbedDraftInputSchema` and runs again inside the bridge, so the dashboard
 * and bot never disagree on what is valid.
 */
import type { EmbedDraftDTO, EmbedFieldDTO, EmbedScheduleIntervalHours } from "$shared/bridge-types";

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T>(value: T): ParseResult<T> => ({ ok: true, value });
const err = <T>(error: string): ParseResult<T> => ({ ok: false, error });

const SCHEDULE_INTERVALS: readonly EmbedScheduleIntervalHours[] = [1, 6, 12, 24, 168];

function text(value: FormDataEntryValue | null): string | null {
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Parses a `#rrggbb` / `rrggbb` color into a 24-bit int. Empty -> null, invalid -> error. */
function parseColor(value: FormDataEntryValue | null): ParseResult<number | null> {
  const raw = text(value);
  if (raw === null) return ok(null);
  const hex = raw.replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return err("color must be a 6-digit hex value.");
  return ok(Number.parseInt(hex, 16));
}

/** Parses the JSON-encoded `fields` input, dropping fully-empty rows. */
function parseFields(value: FormDataEntryValue | null): ParseResult<EmbedFieldDTO[]> {
  const raw = text(value);
  if (raw === null) return ok([]);
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return err("fields payload is malformed.");
  }
  if (!Array.isArray(decoded)) return err("fields payload must be a list.");
  const fields: EmbedFieldDTO[] = [];
  for (const entry of decoded) {
    const row = entry as Record<string, unknown>;
    const name = String(row.name ?? "").trim();
    const value = String(row.value ?? "").trim();
    if (name === "" && value === "") continue; // empty row the user never filled
    fields.push({ name, value, inline: Boolean(row.inline) });
  }
  return ok(fields);
}

function parseSchedule(
  value: FormDataEntryValue | null,
): Pick<EmbedDraftDTO, "scheduleEnabled" | "scheduleIntervalHours"> {
  const raw = text(value);
  if (raw === null || raw === "off") return { scheduleEnabled: false, scheduleIntervalHours: null };
  const hours = Number.parseInt(raw, 10) as EmbedScheduleIntervalHours;
  if (SCHEDULE_INTERVALS.includes(hours)) {
    return { scheduleEnabled: true, scheduleIntervalHours: hours };
  }
  return { scheduleEnabled: false, scheduleIntervalHours: null };
}

export function parseEmbedDraft(data: FormData): ParseResult<EmbedDraftDTO> {
  const color = parseColor(data.get("color"));
  if (!color.ok) return color;
  const fields = parseFields(data.get("fields"));
  if (!fields.ok) return fields;
  const schedule = parseSchedule(data.get("scheduleInterval"));

  return ok({
    embedTitle: text(data.get("title")),
    embedDescription: text(data.get("description")),
    embedColor: color.value,
    embedUrl: text(data.get("url")),
    embedThumbnail: text(data.get("thumbnail")),
    embedImage: text(data.get("image")),
    embedAuthorName: text(data.get("authorName")),
    embedAuthorIconUrl: text(data.get("authorIconUrl")),
    embedAuthorUrl: text(data.get("authorUrl")),
    embedFooterText: text(data.get("footerText")),
    embedFooterIconUrl: text(data.get("footerIconUrl")),
    embedFields: fields.value,
    script: text(data.get("script")),
    scriptEnabled: data.get("scriptEnabled") === "on",
    channelId: text(data.get("channelId")),
    scheduleEnabled: schedule.scheduleEnabled,
    scheduleIntervalHours: schedule.scheduleIntervalHours,
    stickyEnabled: data.get("sticky") === "on",
  });
}

/** Empty draft used when creating a new embed (mirrors the bot's `createBlankEmbedDraft`). */
export function blankEmbedDraft(): EmbedDraftDTO {
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
