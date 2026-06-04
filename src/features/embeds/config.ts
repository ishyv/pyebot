import type { ScheduleIntervalHours } from "@/db/schemas/embed-config";

export const EMBED_WIZARD_TTL_MS = 10 * 60_000;
export const EMBED_STICKY_DEBOUNCE_MS = 3_000;
export const SCHEDULE_SWEEP_INTERVAL_MS = 60_000;
export const EMBED_MAX_FIELDS = 25;

export const SCHEDULE_OPTIONS = [
  { label: "Off", value: "off", hours: null },
  { label: "Every hour", value: "1", hours: 1 as ScheduleIntervalHours },
  { label: "Every 6h", value: "6", hours: 6 as ScheduleIntervalHours },
  { label: "Every 12h", value: "12", hours: 12 as ScheduleIntervalHours },
  { label: "Every day", value: "24", hours: 24 as ScheduleIntervalHours },
  {
    label: "Every week",
    value: "168",
    hours: 168 as ScheduleIntervalHours,
  },
] as const;

export type ScheduleOption = (typeof SCHEDULE_OPTIONS)[number];
