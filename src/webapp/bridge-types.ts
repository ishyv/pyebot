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

export type BotAction =
  | { readonly type: "send_message"; readonly channelId: string; readonly content: string }
  | { readonly type: "kick"; readonly userId: string; readonly reason?: string }
  | {
      readonly type: "ban";
      readonly userId: string;
      readonly reason?: string;
      readonly deleteMessageSeconds?: number;
    };

export type BotEventType =
  | "automod_trigger"
  | "mod_action"
  | "config_changed"
  | "member_join"
  | "member_leave"
  | "appeal_submitted";

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
  listFeatures(guildId: string): Promise<Result<readonly FeatureSummary[], Error>>;
  applyConfig(guildId: string, paths: Record<string, unknown>): Promise<Result<void, Error>>;
  toggleFeature(guildId: string, featureId: string, enabled: boolean): Promise<Result<void, Error>>;
  triggerAction(guildId: string, action: BotAction): Promise<Result<void, Error>>;
  readonly events: EventEmitter;
}
