/**
 * Severity assigned by detectors before guild policy decides the response.
 * Severity is about likely harm, while confidence is about detector certainty.
 */
export type AutomodSeverity = "low" | "medium" | "high" | "critical";

/**
 * Actions a detector may suggest. Policy may downgrade or upgrade this based
 * on profile history, bypasses, and guild posture.
 */
export type AutomodRecommendedAction =
  | "none"
  | "report"
  | "delete"
  | "warn"
  | "timeout"
  | "quarantine"
  | "lockdown-request";

/**
 * Evidence collected by a detector. Keep this compact because message checks
 * run on the hot path and only summaries should be kept in rolling profiles.
 */
export interface AutomodEvidence {
  readonly summary: string;
  readonly messageContent?: string;
  readonly matchedText?: string;
  readonly matchedRule?: string;
  readonly fingerprint?: string;
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
}

/**
 * Target touched by an AutoMod signal. Some signals are user-level, some are
 * channel/server-level, so every id except guildId is optional.
 */
export interface AutomodSignalTarget {
  readonly guildId: string;
  readonly userId?: string;
  readonly channelId?: string;
  readonly messageId?: string;
  readonly messageIds?: readonly string[];
  readonly messageRefs?: readonly {
    readonly channelId: string;
    readonly messageId: string;
  }[];
}

/**
 * Detector output consumed by the shared profile and policy engine.
 * Detectors describe what they saw; they do not directly punish users.
 */
export interface AutomodSignal {
  readonly detectorId: string;
  readonly ruleId?: string;
  readonly confidence: number;
  readonly severity: AutomodSeverity;
  readonly punishmentEligible: boolean;
  readonly recommendedAction: AutomodRecommendedAction;
  readonly target: AutomodSignalTarget;
  readonly evidence: AutomodEvidence;
  readonly createdAt: string;
}

const SEVERITY_WEIGHT: Record<AutomodSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

/**
 * Returns the most important signal using severity first and confidence second.
 */
export function strongestAutomodSignal(signals: readonly AutomodSignal[]): AutomodSignal | null {
  return signals.reduce<AutomodSignal | null>((best, signal) => {
    if (!best) return signal;
    const signalWeight = SEVERITY_WEIGHT[signal.severity];
    const bestWeight = SEVERITY_WEIGHT[best.severity];
    if (signalWeight !== bestWeight) return signalWeight > bestWeight ? signal : best;
    return signal.confidence > best.confidence ? signal : best;
  }, null);
}

/**
 * Produces a stable grouping key for incident aggregation.
 */
export function automodSignalFingerprint(signal: AutomodSignal): string {
  return [
    signal.target.guildId,
    signal.detectorId,
    signal.ruleId ?? "rule",
    signal.evidence.fingerprint ?? signal.evidence.matchedRule ?? signal.evidence.summary,
  ].join(":");
}

/**
 * Numeric severity used by profile risk and policy thresholds.
 */
export function automodSeverityWeight(severity: AutomodSeverity): number {
  return SEVERITY_WEIGHT[severity];
}
