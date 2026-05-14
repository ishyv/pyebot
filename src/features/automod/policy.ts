import type { AutomodConfig } from "@/db/schemas/guild";
import type { AutomodProfile } from "./profile";
import {
  type AutomodRecommendedAction,
  type AutomodSignal,
  automodSeverityWeight,
  strongestAutomodSignal,
} from "./signals";

/**
 * Final policy tier after signals, profile, and bypasses have been evaluated.
 */
export type AutomodPolicyTier =
  | "observe"
  | "report"
  | "delete"
  | "warn"
  | "timeout"
  | "quarantine"
  | "lockdown-request";

/**
 * Minimal member context needed by policy without depending on Discord types.
 */
export interface AutomodPolicyMemberContext {
  readonly isStaff: boolean;
  readonly roleIds: readonly string[];
}

/**
 * Policy decision consumed by the action layer.
 */
export interface AutomodPolicyDecision {
  readonly tier: AutomodPolicyTier;
  readonly action: AutomodRecommendedAction;
  readonly destructive: boolean;
  readonly reason: string;
  readonly score: number;
  readonly signal: AutomodSignal | null;
}

interface EvaluatePolicyInput {
  readonly config: AutomodConfig;
  readonly profile: AutomodProfile;
  readonly signals: readonly AutomodSignal[];
  readonly member: AutomodPolicyMemberContext;
  readonly channelId: string;
}

const PRESET_MULTIPLIER: Record<AutomodConfig["policy"]["preset"], number> = {
  relaxed: 1.25,
  balanced: 1,
  strict: 0.8,
};

function hasAnyRole(member: AutomodPolicyMemberContext, roleIds: readonly string[]): boolean {
  return roleIds.some((roleId) => member.roleIds.includes(roleId));
}

function actionForTier(tier: AutomodPolicyTier): AutomodRecommendedAction {
  if (tier === "observe") return "none";
  return tier;
}

function isDestructiveTier(tier: AutomodPolicyTier): boolean {
  return (
    tier === "delete" ||
    tier === "warn" ||
    tier === "timeout" ||
    tier === "quarantine" ||
    tier === "lockdown-request"
  );
}

/**
 * Converts detector signals and profile history into one guild policy outcome.
 */
export function evaluateAutomodPolicy(input: EvaluatePolicyInput): AutomodPolicyDecision {
  const { config, profile, signals, member, channelId } = input;
  const bypass = config.policy.bypass;
  if (signals.length === 0) {
    return {
      tier: "observe",
      action: "none",
      destructive: false,
      reason: "No AutoMod signals.",
      score: 0,
      signal: null,
    };
  }

  if (bypass.ignoredChannelIds.includes(channelId)) {
    return {
      tier: "observe",
      action: "none",
      destructive: false,
      reason: "Channel is ignored by AutoMod.",
      score: 0,
      signal: null,
    };
  }

  if (bypass.staffBypass && member.isStaff) {
    return {
      tier: "observe",
      action: "none",
      destructive: false,
      reason: "Staff bypass is enabled.",
      score: 0,
      signal: null,
    };
  }

  if (hasAnyRole(member, bypass.protectedRoleIds) || hasAnyRole(member, bypass.trustedRoleIds)) {
    return {
      tier: "observe",
      action: "none",
      destructive: false,
      reason: "Member has a trusted or protected role.",
      score: 0,
      signal: null,
    };
  }

  const strongest = strongestAutomodSignal(signals);
  if (!strongest) {
    return {
      tier: "observe",
      action: "none",
      destructive: false,
      reason: "No strongest signal.",
      score: 0,
      signal: null,
    };
  }

  const signalScore = signals.reduce(
    (total, signal) =>
      total +
      automodSeverityWeight(signal.severity) *
        signal.confidence *
        (signal.punishmentEligible ? 1.2 : 0.75),
    0,
  );
  const strictChannelMultiplier = bypass.strictChannelIds.includes(channelId) ? 1.2 : 1;
  const score = Math.round((profile.riskScore + signalScore * strictChannelMultiplier) * 100) / 100;
  const multiplier = PRESET_MULTIPLIER[config.policy.preset];
  const detectorCount = profile.detectorCounts[strongest.detectorId] ?? 0;

  let tier: AutomodPolicyTier = "report";
  if (!strongest.punishmentEligible) {
    tier = strongest.confidence >= 0.35 ? "report" : "observe";
  } else if (
    strongest.severity === "critical" &&
    strongest.confidence >= 0.9 &&
    detectorCount >= 2
  ) {
    tier = "timeout";
  } else if (strongest.severity === "critical" && strongest.confidence >= 0.85) {
    tier = "delete";
  } else if (score >= 3.8 * multiplier) {
    tier = "quarantine";
  } else if (score >= 2.4 * multiplier) {
    tier = "timeout";
  } else if (score >= 1.6 * multiplier) {
    tier = "warn";
  } else if (score >= 1 * multiplier) {
    tier = "delete";
  }

  return {
    tier,
    action: actionForTier(tier),
    destructive: isDestructiveTier(tier),
    reason: `${strongest.detectorId}: ${strongest.evidence.summary}`,
    score,
    signal: strongest,
  };
}
