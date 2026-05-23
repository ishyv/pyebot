/**
 * Shared type contract for the bot ↔ webapp bridge.
 *
 * This file is the single source of truth for the bridge DTOs and the
 * `BotBridge` interface. Both the bot (`src/webapp/bridge.ts`) and the
 * SvelteKit webapp (`webapp/src/lib/server/bridge.ts`, via the
 * `$shared/bridge-types` alias) import from here.
 *
 * Keep this file type-only. Do not import bot-internal modules (e.g.
 * `@/core/result`) — the webapp bundle must not pull in bot runtime code.
 */

import type { EventEmitter } from "node:events";

// Structural mirror of `@/core/result` Ok/Err. Keeping it here means the
// webapp bundle does not need to resolve bot-internal imports while still
// being assignable from the bot's concrete `Ok`/`Err` class instances.
interface Ok<T, E> {
  readonly ok: true;
  readonly err: false;
  readonly value: T;
  isOk(): this is Ok<T, E>;
  isErr(): this is Err<T, E>;
  unwrap(): T;
}

interface Err<T, E> {
  readonly ok: false;
  readonly err: true;
  readonly error: E;
  isOk(): this is Ok<T, E>;
  isErr(): this is Err<T, E>;
  unwrap(): T;
}

export type Result<T, E = Error> = Ok<T, E> | Err<T, E>;

export interface DiscordChannel {
  readonly id: string;
  readonly name: string;
  readonly type:
    | "text"
    | "voice"
    | "category"
    | "forum"
    | "thread"
    | "announcement"
    | "stage"
    | "other";
  readonly parentId: string | null;
}

export interface DiscordRole {
  readonly id: string;
  readonly name: string;
  readonly color: number;
  readonly position: number;
  readonly managed: boolean;
}

export interface GuildStatus {
  readonly id: string;
  readonly name: string;
  readonly iconUrl: string | null;
  readonly memberCount: number;
  readonly enabledFeatures: readonly string[];
}

export interface FeatureSummary {
  readonly id: string;
  readonly enabled: boolean;
  readonly hasConfig: boolean;
}

export interface EconomyDailyPatch {
  readonly dailyReward?: number;
  readonly dailyCooldownHours?: number;
  readonly dailyStreakBonus?: number;
  readonly dailyFeeRate?: number;
}

export interface EconomyWorkPatch {
  readonly workRewardBase?: number;
  readonly workCooldownMinutes?: number;
  readonly workDailyCap?: number;
  readonly workFailureChance?: number;
  readonly workBaseMintReward?: number;
  readonly workBonusFromWorksMax?: number;
}

export interface EconomyTaxPatch {
  readonly enabled?: boolean;
  readonly rate?: number;
  readonly minimumTaxableAmount?: number;
}

export interface EconomyPatch {
  readonly daily?: EconomyDailyPatch;
  readonly work?: EconomyWorkPatch;
  readonly sectors?: Readonly<Record<string, unknown>>;
}

export interface ModerationSettingsPatch {
  readonly modLogChannelId?: string | null;
  readonly appealsChannelId?: string | null;
  readonly quarantineRoleId?: string | null;
  readonly verifiedRoleId?: string | null;
}

export interface AutomodSettingsPatch {
  readonly linkSpam?: {
    readonly enabled?: boolean;
    readonly maxLinks?: number;
    readonly windowSeconds?: number;
    readonly timeoutSeconds?: number;
    readonly action?: "timeout" | "mute" | "delete" | "report";
    readonly reportChannelId?: string | null;
  };
  readonly domainWhitelist?: {
    readonly enabled?: boolean;
    readonly domains?: readonly string[];
  };
  readonly crossChannelSpam?: {
    readonly enabled?: boolean;
    readonly minChannels?: number;
    readonly windowSeconds?: number;
    readonly reportChannelId?: string | null;
    readonly autoTimeout?: boolean;
    readonly timeoutSeconds?: number;
  };
  readonly mentionSpam?: {
    readonly enabled?: boolean;
    readonly maxMentions?: number;
    readonly windowSeconds?: number;
    readonly action?: "timeout" | "delete" | "report";
    readonly timeoutSeconds?: number;
    readonly reportChannelId?: string | null;
  };
  readonly slowmode?: {
    readonly enabled?: boolean;
    readonly messagesPerWindow?: number;
    readonly windowSeconds?: number;
    readonly slowmodeSeconds?: number;
    readonly releaseAfterSeconds?: number;
  };
  readonly raidDetection?: {
    readonly enabled?: boolean;
    readonly joinsPerMinute?: number;
    readonly minAccountAgeDays?: number;
    readonly action?: "alert" | "lockdown" | "quarantine";
    readonly reportChannelId?: string | null;
  };
  readonly policy?: {
    readonly preset?: "relaxed" | "balanced" | "strict";
    readonly aiDetectorEnabled?: boolean;
    readonly staffBypass?: boolean;
    readonly profileRetentionDays?: number;
  };
  readonly perUserSlow?: {
    readonly enabled?: boolean;
    readonly rules?: readonly {
      readonly enabled: boolean;
      readonly roleId: string;
      readonly cooldownSeconds: number;
      readonly durationSeconds: number;
    }[];
  };
  readonly customPatterns?: readonly {
    readonly name: string;
    readonly pattern: string;
    readonly flags: string;
    readonly action: "delete" | "timeout" | "report";
    readonly timeoutSeconds: number;
  }[];
  readonly imageDetection?: {
    readonly enabled?: boolean;
    readonly reportChannelId?: string | null;
    readonly tolerance?: ImageDetectionTolerance;
  };
}

export type ImageDetectionTolerance = "strict" | "balanced" | "loose";

export interface BannedImageDistanceDTO {
  readonly average: number;
  readonly difference: number;
  readonly verticalDifference: number;
  readonly total: number;
}

export interface BannedImageSummary {
  readonly id: string;
  readonly label: string | null;
  readonly reason: string;
  readonly sourceUrl: string | null;
  readonly sourceContentType: string | null;
  readonly sourceFilename: string | null;
  readonly addedBy: string;
  readonly addedAt: string;
}

export interface BannedImageUploadInput {
  readonly filename: string | null;
  readonly contentType: string | null;
  readonly bytes: Uint8Array;
  readonly reason: string;
  readonly label?: string | null;
}

export interface BannedImageEditPatch {
  readonly reason?: string;
  readonly label?: string | null;
}

export interface BannedImageTestInput {
  readonly filename: string | null;
  readonly contentType: string | null;
  readonly bytes: Uint8Array;
}

export interface BannedImageTestResult {
  readonly matched: boolean;
  readonly record: BannedImageSummary | null;
  readonly distance: BannedImageDistanceDTO | null;
}

export interface RolePolicyPatch {
  readonly roleId: string;
  readonly label?: string;
  readonly discordRoleId?: string | null;
  readonly reach?: Readonly<Record<string, "inherit" | "allow" | "deny">>;
  readonly limits?: Readonly<Record<string, unknown>>;
  readonly updatedBy?: string | null;
}

export interface RpgContentSnapshot {
  readonly items: Readonly<Record<string, unknown>>;
  readonly materials: Readonly<Record<string, unknown>>;
  readonly locations: Readonly<Record<string, unknown>>;
  readonly tools: Readonly<Record<string, unknown>>;
  readonly craftingRecipes: Readonly<Record<string, unknown>>;
  readonly processingRecipes: Readonly<Record<string, unknown>>;
}

export interface CaseSummary {
  readonly userId: string;
  readonly caseId: number;
  readonly type: string;
  readonly description: string;
  readonly date?: string;
  readonly moderatorId?: string;
  readonly source?: string;
  readonly evidenceSummary?: string;
}

export interface AppealSummary {
  readonly guildId: string;
  readonly caseId: number;
  readonly userId: string;
  readonly userTag: string;
  readonly submittedAt: string;
  readonly reason: string;
  readonly status: string;
  readonly threadId: string;
}

export type BotAction =
  | { readonly type: "send_message"; readonly channelId: string; readonly content: string }
  | { readonly type: "kick"; readonly userId: string; readonly reason?: string }
  | {
      readonly type: "ban";
      readonly userId: string;
      readonly reason?: string;
      readonly deleteMessageSeconds?: number;
    };

export type ModerationBridgeAction =
  | {
      readonly type: "warn";
      readonly moderatorId: string;
      readonly targetUserId: string;
      readonly reason: string;
    }
  | {
      readonly type: "timeout";
      readonly moderatorId: string;
      readonly targetUserId: string;
      readonly durationMs: number;
      readonly reason: string;
    }
  | {
      readonly type: "kick";
      readonly moderatorId: string;
      readonly targetUserId: string;
      readonly reason: string;
    }
  | {
      readonly type: "ban";
      readonly moderatorId: string;
      readonly targetUserId: string;
      readonly reason: string;
    }
  | {
      readonly type: "unban";
      readonly moderatorId: string;
      readonly targetUserId: string;
      readonly reason: string;
    }
  | {
      readonly type: "restrict";
      readonly moderatorId: string;
      readonly targetUserId: string;
      readonly roleId: string;
      readonly reason: string;
    };

export type EmbedScheduleIntervalHours = 1 | 6 | 12 | 24 | 168;

export interface EmbedFieldDTO {
  readonly name: string;
  readonly value: string;
  readonly inline: boolean;
}

/** The editable subset of an embed sent from the dashboard. Mirrors `EmbedConfigDraft`. */
export interface EmbedDraftDTO {
  readonly embedTitle: string | null;
  readonly embedDescription: string | null;
  readonly embedColor: number | null;
  readonly embedUrl: string | null;
  readonly embedThumbnail: string | null;
  readonly embedImage: string | null;
  readonly embedAuthorName: string | null;
  readonly embedAuthorIconUrl: string | null;
  readonly embedAuthorUrl: string | null;
  readonly embedFooterText: string | null;
  readonly embedFooterIconUrl: string | null;
  readonly embedFields: readonly EmbedFieldDTO[];
  readonly script: string | null;
  readonly scriptEnabled: boolean;
  readonly channelId: string | null;
  readonly scheduleEnabled: boolean;
  readonly scheduleIntervalHours: EmbedScheduleIntervalHours | null;
  readonly stickyEnabled: boolean;
}

/** Full stored embed returned to the editor. Mirrors `EmbedConfig`. */
export interface EmbedConfigDTO extends EmbedDraftDTO {
  readonly _id: string;
  readonly guildId: string;
  readonly name: string;
  readonly createdBy: string;
  readonly stickyMessageId: string | null;
  readonly stickyLastResendAt: Date | null;
  readonly scheduledNextSendAt: Date | null;
  readonly scheduledLastSentAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Compact embed shape for the list page. */
export interface EmbedSummary {
  readonly name: string;
  readonly channelId: string | null;
  readonly stickyEnabled: boolean;
  readonly scheduleEnabled: boolean;
  readonly scheduleIntervalHours: EmbedScheduleIntervalHours | null;
  readonly updatedAt: Date;
}

export type BotEventType =
  | "automod_trigger"
  | "mod_action"
  | "config_changed"
  | "member_join"
  | "member_leave"
  | "appeal_submitted"
  | "appeal_decided"
  | "rpg_content_reloaded";

export interface BotEvent {
  readonly type: BotEventType;
  readonly guildId: string;
  readonly actorId?: string;
  readonly targetId?: string;
  readonly detail: string;
  readonly timestamp: number;
}

export interface BotBridge {
  getChannels(guildId: string): Promise<Result<readonly DiscordChannel[], Error>>;
  getRoles(guildId: string): Promise<Result<readonly DiscordRole[], Error>>;
  getGuildStatus(guildId: string): Promise<Result<GuildStatus, Error>>;
  /** Full guild config document as a plain JSON value. */
  getGuildConfig(guildId: string): Promise<Result<Record<string, unknown>, Error>>;
  getAdminState(guildId: string): Promise<Result<Record<string, unknown>, Error>>;
  listFeatures(guildId: string): Promise<Result<readonly FeatureSummary[], Error>>;
  saveChannels(
    guildId: string,
    slots: Record<string, string | null>,
    actorId?: string | null,
  ): Promise<Result<void, Error>>;
  saveModeration(
    guildId: string,
    patch: ModerationSettingsPatch,
    actorId?: string | null,
  ): Promise<Result<void, Error>>;
  saveAutomod(
    guildId: string,
    patch: AutomodSettingsPatch,
    actorId?: string | null,
  ): Promise<Result<void, Error>>;
  listBannedImages(guildId: string): Promise<Result<readonly BannedImageSummary[], Error>>;
  addBannedImage(
    guildId: string,
    input: BannedImageUploadInput,
    actorId?: string | null,
  ): Promise<Result<BannedImageSummary, Error>>;
  editBannedImage(
    guildId: string,
    id: string,
    patch: BannedImageEditPatch,
    actorId?: string | null,
  ): Promise<Result<BannedImageSummary, Error>>;
  removeBannedImage(
    guildId: string,
    id: string,
    actorId?: string | null,
  ): Promise<Result<BannedImageSummary, Error>>;
  testBannedImage(
    guildId: string,
    input: BannedImageTestInput,
  ): Promise<Result<BannedImageTestResult, Error>>;
  saveEconomy(
    guildId: string,
    patch: EconomyPatch,
    actorId?: string | null,
  ): Promise<Result<void, Error>>;
  saveEconomyTax(
    guildId: string,
    patch: EconomyTaxPatch,
    actorId?: string | null,
  ): Promise<Result<void, Error>>;
  saveRolePolicy(guildId: string, patch: RolePolicyPatch): Promise<Result<void, Error>>;
  listCases(guildId: string): Promise<Result<readonly CaseSummary[], Error>>;
  editCase(
    guildId: string,
    actorId: string,
    userId: string,
    caseId: number,
    description: string,
  ): Promise<Result<void, Error>>;
  deleteCase(
    guildId: string,
    actorId: string,
    userId: string,
    caseId: number,
  ): Promise<Result<void, Error>>;
  listAppeals(guildId: string): Promise<Result<readonly AppealSummary[], Error>>;
  resolveAppeal(
    guildId: string,
    caseId: number,
    reviewerId: string,
    status: "approved" | "denied",
    note: string,
  ): Promise<Result<void, Error>>;
  runModerationAction(
    guildId: string,
    action: ModerationBridgeAction,
  ): Promise<Result<void, Error>>;
  getRpgContent(): Promise<Result<RpgContentSnapshot, Error>>;
  saveRpgContent(snapshot: RpgContentSnapshot): Promise<Result<RpgContentSnapshot, Error>>;
  reloadRpgContent(): Promise<Result<RpgContentSnapshot, Error>>;
  applyConfig(
    guildId: string,
    paths: Record<string, unknown>,
    actorId?: string | null,
  ): Promise<Result<void, Error>>;
  toggleFeature(
    guildId: string,
    featureId: string,
    enabled: boolean,
    actorId?: string | null,
  ): Promise<Result<void, Error>>;
  triggerAction(guildId: string, action: BotAction): Promise<Result<void, Error>>;
  listEmbeds(guildId: string): Promise<Result<readonly EmbedSummary[], Error>>;
  getEmbed(guildId: string, name: string): Promise<Result<EmbedConfigDTO | null, Error>>;
  saveEmbed(
    guildId: string,
    name: string,
    draft: EmbedDraftDTO,
    actorId?: string | null,
  ): Promise<Result<EmbedConfigDTO, Error>>;
  deleteEmbed(
    guildId: string,
    name: string,
    actorId?: string | null,
  ): Promise<Result<boolean, Error>>;
  sendEmbed(
    guildId: string,
    name: string,
    actorId?: string | null,
  ): Promise<Result<{ readonly messageId: string }, Error>>;
  readonly events: EventEmitter;
}
