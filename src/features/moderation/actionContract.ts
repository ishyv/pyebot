export const MODERATION_SOURCES = ["manual", "automod", "appeal", "escalation", "system"] as const;
export type ModerationSource = (typeof MODERATION_SOURCES)[number];

export const MODERATION_ACTOR_TYPES = ["user", "bot", "system"] as const;
export type ModerationActorType = (typeof MODERATION_ACTOR_TYPES)[number];

export const MODERATION_ACTIONS = [
  "WARN",
  "TIMEOUT",
  "KICK",
  "BAN",
  "UNBAN",
  "RESTRICT",
  "RELEASE",
  "PURGE",
  "LOCKDOWN",
  "SLOWMODE",
  "VERIFY_KICK",
  "CONFIG_CHANGE",
  "CASE_EDIT",
  "CASE_DELETE",
] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

const DESTRUCTIVE_ACTIONS = new Set<ModerationAction>([
  "TIMEOUT",
  "KICK",
  "BAN",
  "RESTRICT",
  "RELEASE",
  "PURGE",
  "LOCKDOWN",
  "SLOWMODE",
  "VERIFY_KICK",
  "CASE_DELETE",
]);

export interface ModerationActionRequest {
  readonly guildId: string;
  readonly source: ModerationSource;
  readonly action: ModerationAction;
  readonly actor: {
    readonly type: ModerationActorType;
    readonly userId?: string;
    readonly roleIds?: readonly string[];
  };
  readonly target: {
    readonly userId?: string;
    readonly channelId?: string;
    readonly messageIds?: readonly string[];
  };
  readonly reason: string;
  readonly evidence?: {
    readonly summary: string;
    readonly messageContent?: string;
    readonly matchedRule?: string;
    readonly configPath?: string;
  };
  readonly requestedAt: string;
}

export interface ModerationActionResult {
  readonly ok: boolean;
  readonly caseId?: number;
  readonly incidentId?: string;
  readonly discordActionId?: string;
  readonly errorCode?: string;
  readonly errorMessage?: string;
}

export interface ModerationActionPipeline {
  authorizeModerationAction(request: ModerationActionRequest): Promise<ModerationActionResult>;
  executeModerationAction(request: ModerationActionRequest): Promise<ModerationActionResult>;
  recordModerationAction(
    request: ModerationActionRequest,
    result: ModerationActionResult,
  ): Promise<ModerationActionResult>;
}

export function isDestructiveModerationAction(action: ModerationAction): boolean {
  return DESTRUCTIVE_ACTIONS.has(action);
}

export function moderationActionLabel(action: ModerationAction): string {
  if (action === "VERIFY_KICK") return "Verification kick";
  return action
    .toLowerCase()
    .split("_")
    .map((part, index) => (index === 0 ? `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}` : part))
    .join(" ");
}
