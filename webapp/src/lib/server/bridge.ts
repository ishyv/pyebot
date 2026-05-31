/**
 * Webapp-side accessor for the bot bridge.
 *
 * The bot registers the live bridge on `globalThis` during startup (see
 * `src/webapp/bridge.ts` in the bot codebase). This module re-exports the
 * shared type contract and exposes a single `getBridge()` for SvelteKit
 * server-side code.
 *
 * Type contract lives in `src/webapp/bridge-types.ts`, reachable here via
 * the `$shared/bridge-types` alias declared in `svelte.config.js`.
 */

export type {
  AppealSummary,
  AutomodSettingsPatch,
  BotAction,
  BotBridge,
  BotEvent,
  BotEventType,
  CaseSummary,
  DiscordChannel,
  DiscordRole,
  EconomyDailyPatch,
  EconomyPatch,
  EconomyTaxPatch,
  EconomyWorkPatch,
  FeatureSummary,
  GuildStatus,
  ModerationBridgeAction,
  ModerationSettingsPatch,
  Result,
  RolePolicyPatch,
  RpgContentSnapshot,
} from "$shared/bridge-types";

import type { BotBridge } from "$shared/bridge-types";

const REGISTRY_KEY = "__txBotBridge__";

type Holder = { bridge: BotBridge | null };

function holder(): Holder {
  const g = globalThis as unknown as Record<string, Holder | undefined>;
  return g[REGISTRY_KEY] ?? { bridge: null };
}

export function hasBridge(): boolean {
  return holder().bridge !== null;
}

export function getBridge(): BotBridge {
  const bridge = holder().bridge;
  if (!bridge) {
    throw new Error("Bot bridge not registered. The webapp must be started by the bot.");
  }
  return bridge;
}
