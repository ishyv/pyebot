import { type AutomodSignal, automodSignalFingerprint } from "./signals";

/**
 * Aggregated incident state for flood-friendly alerting.
 */
export interface AutomodIncident {
  readonly id: string;
  readonly guildId: string;
  readonly detectorId: string;
  readonly fingerprint: string;
  readonly userIds: readonly string[];
  readonly channelIds: readonly string[];
  readonly messageIds: readonly string[];
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
  readonly count: number;
}

interface RecordIncidentOptions {
  readonly now: Date;
  readonly windowSeconds: number;
}

function uniqueAppend(values: readonly string[], value: string | undefined): string[] {
  if (!value) return [...values];
  return values.includes(value) ? [...values] : [...values, value];
}

/**
 * Records one signal into a caller-owned incident map, grouping related floods.
 */
export function recordAutomodIncident(
  incidents: Map<string, AutomodIncident>,
  signal: AutomodSignal,
  options: RecordIncidentOptions,
): AutomodIncident {
  const fingerprint = automodSignalFingerprint(signal);
  const existing = incidents.get(fingerprint);
  const windowMs = Math.max(options.windowSeconds, 1) * 1000;
  const nowIso = options.now.toISOString();
  if (!existing || options.now.getTime() - new Date(existing.lastSeenAt).getTime() > windowMs) {
    const incident: AutomodIncident = {
      id: `${fingerprint}:${options.now.getTime()}`,
      guildId: signal.target.guildId,
      detectorId: signal.detectorId,
      fingerprint,
      userIds: signal.target.userId ? [signal.target.userId] : [],
      channelIds: signal.target.channelId ? [signal.target.channelId] : [],
      messageIds: [
        ...(signal.target.messageId ? [signal.target.messageId] : []),
        ...(signal.target.messageIds ?? []),
      ],
      firstSeenAt: nowIso,
      lastSeenAt: nowIso,
      count: 1,
    };
    incidents.set(fingerprint, incident);
    return incident;
  }

  const incident: AutomodIncident = {
    ...existing,
    userIds: uniqueAppend(existing.userIds, signal.target.userId),
    channelIds: uniqueAppend(existing.channelIds, signal.target.channelId),
    messageIds: [
      ...existing.messageIds,
      ...[
        ...(signal.target.messageId ? [signal.target.messageId] : []),
        ...(signal.target.messageIds ?? []),
      ].filter((id) => !existing.messageIds.includes(id)),
    ],
    lastSeenAt: nowIso,
    count: existing.count + 1,
  };
  incidents.set(fingerprint, incident);
  return incident;
}
