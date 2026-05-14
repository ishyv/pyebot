import { type AutomodSignal, automodSeverityWeight } from "./signals";

/**
 * Compact retained signal entry. Profiles intentionally keep summaries rather
 * than full Discord objects so they stay reviewable and cheap to update.
 */
export interface AutomodProfileSignalEntry {
  readonly detectorId: string;
  readonly ruleId?: string;
  readonly severity: AutomodSignal["severity"];
  readonly confidence: number;
  readonly punishmentEligible: boolean;
  readonly recommendedAction: AutomodSignal["recommendedAction"];
  readonly summary: string;
  readonly createdAt: string;
}

/**
 * Rolling AutoMod profile for one guild user. It is policy input, not a
 * punishment record; cases/incidents remain the durable audit trail.
 */
export interface AutomodProfile {
  readonly guildId: string;
  readonly userId: string;
  readonly signals: readonly AutomodProfileSignalEntry[];
  readonly detectorCounts: Readonly<Record<string, number>>;
  readonly confirmedActionCounts: Readonly<Record<string, number>>;
  readonly falsePositiveDismissals: number;
  readonly riskScore: number;
  readonly accountAgeDays?: number;
  readonly trustedRoleState?: "trusted" | "protected" | "none";
  readonly lastUpdatedAt: string;
}

interface UpdateProfileOptions {
  readonly now: Date;
  readonly retentionDays: number;
  readonly confirmedAction?: string;
  readonly falsePositiveDismissal?: boolean;
  readonly accountAgeDays?: number;
  readonly trustedRoleState?: "trusted" | "protected" | "none";
}

function toEntry(signal: AutomodSignal): AutomodProfileSignalEntry {
  return {
    detectorId: signal.detectorId,
    ...(signal.ruleId ? { ruleId: signal.ruleId } : {}),
    severity: signal.severity,
    confidence: signal.confidence,
    punishmentEligible: signal.punishmentEligible,
    recommendedAction: signal.recommendedAction,
    summary: signal.evidence.summary,
    createdAt: signal.createdAt,
  };
}

function countByDetector(entries: readonly AutomodProfileSignalEntry[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of entries) counts[entry.detectorId] = (counts[entry.detectorId] ?? 0) + 1;
  return counts;
}

function calculateRisk(
  entries: readonly AutomodProfileSignalEntry[],
  now: Date,
  retentionDays: number,
): number {
  const retentionMs = Math.max(retentionDays, 1) * 24 * 60 * 60 * 1000;
  const score = entries.reduce((total, entry) => {
    const ageMs = Math.max(0, now.getTime() - new Date(entry.createdAt).getTime());
    const freshness = Math.max(0.15, 1 - ageMs / retentionMs);
    const eligibility = entry.punishmentEligible ? 1.2 : 0.75;
    return (
      total + automodSeverityWeight(entry.severity) * entry.confidence * freshness * eligibility
    );
  }, 0);
  return Math.round(score * 100) / 100;
}

/**
 * Applies new signals to a rolling profile and prunes expired evidence.
 */
export function updateAutomodProfile(
  existing: AutomodProfile | null,
  signals: readonly AutomodSignal[],
  options: UpdateProfileOptions,
): AutomodProfile {
  const retentionMs = Math.max(options.retentionDays, 1) * 24 * 60 * 60 * 1000;
  const cutoff = options.now.getTime() - retentionMs;
  const retained = [...(existing?.signals ?? []), ...signals.map(toEntry)].filter(
    (entry) => new Date(entry.createdAt).getTime() >= cutoff,
  );

  const confirmedActionCounts = { ...(existing?.confirmedActionCounts ?? {}) };
  if (options.confirmedAction) {
    confirmedActionCounts[options.confirmedAction] =
      (confirmedActionCounts[options.confirmedAction] ?? 0) + 1;
  }

  const firstSignal = signals[0];
  return {
    guildId: existing?.guildId ?? firstSignal?.target.guildId ?? "",
    userId: existing?.userId ?? firstSignal?.target.userId ?? "",
    signals: retained,
    detectorCounts: countByDetector(retained),
    confirmedActionCounts,
    falsePositiveDismissals:
      (existing?.falsePositiveDismissals ?? 0) + (options.falsePositiveDismissal ? 1 : 0),
    riskScore: calculateRisk(retained, options.now, options.retentionDays),
    ...(options.accountAgeDays !== undefined ? { accountAgeDays: options.accountAgeDays } : {}),
    trustedRoleState: options.trustedRoleState ?? existing?.trustedRoleState ?? "none",
    lastUpdatedAt: options.now.toISOString(),
  };
}
