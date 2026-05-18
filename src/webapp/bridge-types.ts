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

export interface EconomyPatch {
  readonly daily?: Readonly<Record<string, unknown>>;
  readonly work?: Readonly<Record<string, unknown>>;
  readonly sectors?: Readonly<Record<string, unknown>>;
}

export interface ModerationSettingsPatch {
  readonly modLogChannelId?: string | null;
  readonly appealsChannelId?: string | null;
  readonly quarantineRoleId?: string | null;
  readonly verifiedRoleId?: string | null;
}

export interface AutomodSettingsPatch {
  readonly linkSpam?: Readonly<Record<string, unknown>>;
  readonly mentionSpam?: Readonly<Record<string, unknown>>;
}

export interface RolePolicyPatch {
  readonly roleId: string;
  readonly label?: string;
  readonly discordRoleId?: string | null;
  readonly reach?: Readonly<Record<string, "inherit" | "allow" | "deny">>;
  readonly limits?: Readonly<Record<string, unknown>>;
  readonly updatedBy?: string | null;
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
  saveEconomy(
    guildId: string,
    patch: EconomyPatch,
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
  getRpgContent(): Promise<Result<Record<string, unknown>, Error>>;
  saveRpgContent(
    snapshot: Record<string, unknown>,
  ): Promise<Result<Record<string, unknown>, Error>>;
  reloadRpgContent(): Promise<Result<Record<string, unknown>, Error>>;
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
  readonly events: EventEmitter;
}
