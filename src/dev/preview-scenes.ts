/**
 * Preview-scene registry — the single place that "owns" every bot UI we want to
 * inspect in the webapp playground without a live Discord client.
 *
 * Each scene builds a real message payload by calling the feature's actual
 * render function with an in-memory mock `Ctx` (no DB, no gateway), then the
 * dump script (`scripts/dump-preview-scenes.ts`) serializes the discord.js
 * builders via `.toJSON()` into `webapp/src/lib/discord-preview/scenes.generated.json`.
 * The webapp reads that static file — so there is no webapp→bot build coupling.
 *
 * To add a feature's UI to the playground: register a scene here that returns
 * its render output, then run `bun run scenes:dump`.
 */

import { User } from "@/components/entities";
import { UserInventory } from "@/components/rpg/inventory";
import { RpgProfile } from "@/components/rpg/profile";
import { UserCurrency } from "@/components/user-currency";
import { UserFactory } from "@/components/user-factory";
import { renderDashboard } from "@/features/tycoon/dashboard";
import type { EntityComponent, EntityKind } from "@/framework";
import type { Component, Ctx } from "@/framework/types";

export interface SerializedPayload {
  readonly flags?: number;
  readonly components: unknown[];
}

export interface PreviewScene {
  readonly id: string;
  readonly label: string;
  readonly build: () => Promise<SerializedPayload>;
}

/** Minimal store-backed Ctx for render functions (mirrors the tycoon tests). */
function mockCtx(seed: Record<string, Record<string, unknown>> = {}): Ctx {
  const store: Record<string, Record<string, unknown>> = {};
  for (const [coll, byId] of Object.entries(seed)) store[coll] = { ...byId };
  const bucket = (coll: string) => {
    store[coll] ??= {};
    return store[coll];
  };
  return {
    async get<T>(id: string, component: Component<T>) {
      return (bucket(component.collection)[id] as T) ?? null;
    },
    async ensure<T>(id: string, component: Component<T>) {
      const b = bucket(component.collection);
      if (!(id in b)) b[id] = component.schema.parse({});
      return b[id] as T;
    },
    async set() {},
    async patch() {},
    async delete() {},
    async query<T>(component: Component<T>) {
      return Object.entries(bucket(component.collection)).map(([id, value]) => ({
        _id: id,
        ...(value as Record<string, unknown>),
      })) as never;
    },
    of(kind: EntityKind, id: string) {
      const entityDoc = () => bucket(kind.collection)[id] as Record<string, unknown> | undefined;
      return {
        async get<T>(component: EntityComponent<T>) {
          return component.schema.parse(entityDoc()?.[component.name] ?? {});
        },
        async peek<T>(component: EntityComponent<T>) {
          const doc = entityDoc();
          if (!doc || !(component.name in doc)) return null;
          return component.schema.parse(doc[component.name]);
        },
        async update<T>(
          component: EntityComponent<T>,
          patch: Partial<T> | ((current: T) => Partial<T>),
        ) {
          const b = bucket(kind.collection);
          if (!(id in b)) b[id] = { _id: id };
          const doc = b[id] as Record<string, unknown>;
          const current = component.schema.parse(doc[component.name] ?? {});
          const partial = typeof patch === "function" ? patch(current) : patch;
          doc[component.name] = { ...current, ...partial };
        },
      };
    },
    select() {
      throw new Error("select not implemented in preview ctx");
    },
    transaction() {
      throw new Error("transaction not implemented in preview ctx");
    },
    async emit() {},
    client: {},
    logger: { info() {}, warn() {}, error() {}, debug() {} },
    cooldowns: {},
    locks: {},
    sessions: {},
    interaction: null,
  } as unknown as Ctx;
}

const USER = "preview-user";
const HOUR = 3_600_000;

/** A line state literal for the UserFactory seed. */
function line(opts: {
  levels?: Partial<Record<"extractor" | "refinery" | "assembler", number>>;
  mode?: "sell" | "stockpile";
  automated?: boolean;
  agoHours?: number;
}) {
  return {
    stages: {
      extractor: { level: opts.levels?.extractor ?? 1 },
      refinery: { level: opts.levels?.refinery ?? 1 },
      assembler: { level: opts.levels?.assembler ?? 1 },
    },
    mode: opts.mode ?? "sell",
    automated: opts.automated ?? false,
    lastCollectedAt: Date.now() - (opts.agoHours ?? 0) * HOUR,
  };
}

function serialize(payload: {
  flags?: number;
  components: readonly { toJSON(): unknown }[];
}): SerializedPayload {
  return { flags: payload.flags, components: payload.components.map((c) => c.toJSON()) };
}

const tycoon = (seed: Record<string, Record<string, unknown>>) => async () =>
  serialize(await renderDashboard(mockCtx(seed), USER));

export const PREVIEW_SCENES: readonly PreviewScene[] = [
  {
    id: "tycoon-empty",
    label: "tycoon · first run (no lines)",
    build: tycoon({
      [UserCurrency.collection]: {
        [USER]: { balances: { coins: 500, scrip: 0 }, bankBalances: {} },
      },
      [User.collection]: { [USER]: { [UserFactory.name]: { lines: {}, lifetimeScrip: 0 } } },
    }),
  },
  {
    id: "tycoon-midgame",
    label: "tycoon · mid-game (ready + bottleneck)",
    build: tycoon({
      [UserCurrency.collection]: {
        [USER]: { balances: { coins: 8300, scrip: 1240 }, bankBalances: {} },
      },
      [User.collection]: {
        [USER]: {
          [UserFactory.name]: {
            lines: {
              iron_works: line({
                levels: { extractor: 7, refinery: 4, assembler: 7 },
                agoHours: 6,
              }),
              lumber_mill: line({
                levels: { extractor: 5, refinery: 5, assembler: 5 },
                automated: true,
                agoHours: 30,
              }),
            },
            lifetimeScrip: 11_260,
          },
        },
      },
    }),
  },
  {
    id: "tycoon-capped",
    label: "tycoon · storage full (manual cap)",
    build: tycoon({
      [UserCurrency.collection]: {
        [USER]: { balances: { coins: 400, scrip: 0 }, bankBalances: {} },
      },
      [User.collection]: {
        [USER]: {
          [UserInventory.name]: { slots: {} },
          [UserFactory.name]: {
            lines: { lumber_mill: line({ agoHours: 100 }) },
            lifetimeScrip: 600,
          },
          [RpgProfile.name]: { stashSize: 20 },
        },
      },
    }),
  },
];

/** Runs every scene and returns serialized payloads for the dump script. */
export async function serializeAllScenes(): Promise<
  { id: string; label: string; payload: SerializedPayload }[]
> {
  return Promise.all(
    PREVIEW_SCENES.map(async (scene) => ({
      id: scene.id,
      label: scene.label,
      payload: await scene.build(),
    })),
  );
}
