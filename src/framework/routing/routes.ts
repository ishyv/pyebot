/**
 * `defineRoutes` — one typed declaration per feature that drives BOTH encoding
 * (building a customId from typed args) and decoding/dispatch (handing a handler
 * already-parsed, typed args).
 *
 *   export const routes = defineRoutes("example", {
 *     greet: { target: snowflake },                  // bare schema → button route
 *     pick:  route({ session: str }, "select"),      // explicit component kind
 *   });
 *
 *   routes.greet.id({ target })          // → "example:greet:123…"
 *   routes.greet.button({ target })      // → a prefilled ButtonBuilder
 *
 * The handler side (registry.ts `routeHandlers`) reads the same table so each
 * callback's `args` and interaction type are inferred — no annotations, no drift.
 *
 * Encoding note: every id is `ns:route:` + the joined segments, so a zero-arg
 * route encodes to `ns:route:` (trailing colon). The trailing colon makes the
 * router prefix `ns:route:` unambiguous — `example:greet:` can never be confused
 * with `example:greeting:`.
 */

import type { ButtonInteraction } from "discord.js";
import {
  ButtonBuilder,
  type ButtonStyle,
  ButtonStyle as ButtonStyleEnum,
  type ChannelSelectMenuInteraction,
  type MentionableSelectMenuInteraction,
  type ModalSubmitInteraction,
  type RoleSelectMenuInteraction,
  type StringSelectMenuInteraction,
  type UserSelectMenuInteraction,
} from "discord.js";
import type { Codec } from "./codecs";
import type { Schema } from "./decode";

// ─── Component kinds ─────────────────────────────────────────────────────────
export type ComponentKind =
  | "button"
  | "select"
  | "user-select"
  | "channel-select"
  | "role-select"
  | "mentionable-select"
  | "modal";

/** Maps a declared component kind to its narrowed discord.js interaction type. */
export type InteractionOf<K extends ComponentKind> = K extends "button"
  ? ButtonInteraction
  : K extends "select"
    ? StringSelectMenuInteraction
    : K extends "user-select"
      ? UserSelectMenuInteraction
      : K extends "channel-select"
        ? ChannelSelectMenuInteraction
        : K extends "role-select"
          ? RoleSelectMenuInteraction
          : K extends "mentionable-select"
            ? MentionableSelectMenuInteraction
            : K extends "modal"
              ? ModalSubmitInteraction
              : never;

// ─── Schema → args ───────────────────────────────────────────────────────────
export type ArgsOf<S extends Schema> = {
  [K in keyof S]: S[K] extends Codec<infer T> ? T : never;
};

// ─── Route definitions (bare schema or route(schema, kind)) ──────────────────
declare const ROUTE_BRAND: unique symbol;

export interface RouteDef<S extends Schema, K extends ComponentKind> {
  /** Phantom marker — never set at runtime. Distinguishes a route(...) from a bare schema. */
  readonly [ROUTE_BRAND]?: true;
  readonly schema: S;
  readonly kind: K;
}

/** Declare a route with an explicit component kind so the handler's `i` narrows. */
export function route<const S extends Schema, K extends ComponentKind = "button">(
  schema: S,
  kind: K = "button" as K,
): RouteDef<S, K> {
  return { schema, kind };
}

/** A route entry value accepted by defineRoutes: a bare schema or a route(...). */
export type RouteInput = Schema | RouteDef<Schema, ComponentKind>;

export type SchemaOf<V extends RouteInput> =
  V extends RouteDef<infer S, ComponentKind> ? S : V extends Schema ? V : never;

export type KindOf<V extends RouteInput> = V extends RouteDef<Schema, infer K> ? K : "button";

// ─── The route table ─────────────────────────────────────────────────────────
export interface ButtonOptions {
  readonly label?: string;
  readonly style?: ButtonStyle;
  readonly emoji?: string;
  readonly disabled?: boolean;
}

export interface RouteEntry<NS extends string, V extends RouteInput> {
  readonly ns: NS;
  readonly name: string;
  readonly kind: KindOf<V>;
  readonly schema: SchemaOf<V>;
  /** Router prefix this route owns, e.g. "example:greet:". */
  readonly prefix: string;
  /** Encode typed args into a customId string. */
  id(args: ArgsOf<SchemaOf<V>>): string;
  /** Build a ButtonBuilder with this route's customId prefilled. */
  button(args: ArgsOf<SchemaOf<V>>, options?: ButtonOptions): ButtonBuilder;
}

declare const META: unique symbol;

export type RouteTable<NS extends string, D extends Record<string, RouteInput>> = {
  readonly [Name in keyof D]: RouteEntry<NS, D[Name]>;
} & { readonly [META]: { readonly ns: NS; readonly def: D } };

/** Recover the route-definition map from a table — used by registry.ts for typing. */
export type DefOf<T> = T extends RouteTable<string, infer D> ? D : never;
export type NsOf<T> = T extends RouteTable<infer NS, Record<string, RouteInput>> ? NS : never;

// Runtime symbol that backs the phantom META key.
const META_KEY = Symbol("routes.meta") as unknown as typeof META;

const ID_SEGMENT = /^[a-z][a-z0-9-]*$/;

function asRouteDef(value: RouteInput): { schema: Schema; kind: ComponentKind } {
  // A route(schema, kind) has a string `kind`; a bare schema's fields are all
  // Codec objects, so `typeof kind === "string"` reliably tells them apart.
  const v = value as Record<string, unknown>;
  if (typeof v.kind === "string" && typeof v.schema === "object" && v.schema !== null) {
    return { schema: v.schema as Schema, kind: v.kind as ComponentKind };
  }
  return { schema: value as Schema, kind: "button" };
}

/** Define a feature's component routes. See file header. */
export function defineRoutes<const NS extends string, const D extends Record<string, RouteInput>>(
  ns: NS,
  def: D,
): RouteTable<NS, D> {
  if (!ID_SEGMENT.test(ns)) {
    throw new Error(`Invalid route namespace "${ns}". Use lowercase letters, numbers, hyphens.`);
  }
  const table: Record<PropertyKey, unknown> = { [META_KEY]: { ns, def } };

  for (const name of Object.keys(def)) {
    if (!ID_SEGMENT.test(name)) {
      throw new Error(
        `Invalid route name "${name}" in "${ns}". Use lowercase letters, numbers, hyphens.`,
      );
    }
    const { schema, kind } = asRouteDef(def[name] as RouteInput);
    const fields = Object.keys(schema);
    fields.forEach((field, i) => {
      if (schema[field]?.greedy && i !== fields.length - 1) {
        throw new Error(`Route "${ns}:${name}": greedy field "${field}" must be the last field.`);
      }
    });

    const prefix = `${ns}:${name}:`;
    const encode = (args: Record<string, unknown>): string => {
      const segs = fields.map((field) => (schema[field] as Codec<unknown>).encode(args[field]));
      return prefix + segs.join(":");
    };

    table[name] = {
      ns,
      name,
      kind,
      schema,
      prefix,
      id: encode,
      button(args: Record<string, unknown>, options?: ButtonOptions): ButtonBuilder {
        const b = new ButtonBuilder()
          .setCustomId(encode(args))
          .setStyle(options?.style ?? ButtonStyleEnum.Primary);
        if (options?.label) b.setLabel(options.label);
        if (options?.emoji) b.setEmoji(options.emoji);
        if (options?.disabled) b.setDisabled(options.disabled);
        return b;
      },
    } satisfies RouteEntry<NS, RouteInput>;
  }

  return table as RouteTable<NS, D>;
}

/** Internal accessor for registry.ts: read the runtime meta off a table. */
export function routeMeta(table: RouteTable<string, Record<string, RouteInput>>): {
  ns: string;
  def: Record<string, RouteInput>;
} {
  return (table as unknown as Record<symbol, { ns: string; def: Record<string, RouteInput> }>)[
    META_KEY
  ];
}
