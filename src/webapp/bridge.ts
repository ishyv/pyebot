/**
 * Bot-side bridge: re-exports the shared type contract and owns the
 * runtime registry used to hand the live `BotBridge` instance to the
 * separately-bundled webapp.
 *
 * Type contract lives in `./bridge-types`. Both this module and the
 * webapp's `webapp/src/lib/server/bridge.ts` import from there.
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
} from "./bridge-types";

import type { BotBridge } from "./bridge-types";

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
