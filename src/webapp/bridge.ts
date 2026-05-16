/**
 * Single coupling point between the bot process and the embedded webapp.
 *
 * The webapp is bundled separately by vite (its server-side code lives in a
 * different TypeScript compilation unit). Using `globalThis` for the registry
 * lets both copies of this module agree on a single instance at runtime: the
 * bot writes during startup, the webapp reads when serving requests.
 *
 * The webapp keeps a mirror of this interface in
 * `webapp/src/lib/server/bridge.ts`. Keep the two in sync — they describe the
 * same shared object.
 */

import type { EventEmitter } from "node:events";
import type { Result } from "@/core/result";

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
  readonly gate: string | null;
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

// Stored on globalThis because the bot and the webapp bundle each get their
// own module instance after vite/SvelteKit build. The shared global is the
// only thing the two units can both see.
const REGISTRY_KEY = "__txBotBridge__";

type Holder = { bridge: BotBridge | null };

function holder(): Holder {
  const g = globalThis as unknown as Record<string, Holder | undefined>;
  if (!g[REGISTRY_KEY]) g[REGISTRY_KEY] = { bridge: null };
  return g[REGISTRY_KEY] as Holder;
}

export function registerBridge(bridge: BotBridge): void {
  holder().bridge = bridge;
}

export function getBridge(): BotBridge {
  const bridge = holder().bridge;
  if (!bridge) throw new Error("Bot bridge not registered yet.");
  return bridge;
}

export function hasBridge(): boolean {
  return holder().bridge !== null;
}
