/**
 * Entity-component declarations — the entity-centric evolution of `component()`.
 *
 * The original `component()` pairs a Zod schema with its *own* MongoDB
 * collection, so every component is a separate collection keyed by entity id.
 * That makes "add a small counter to users" spawn a whole collection and an
 * extra round-trip. This module flips the model the way a game ECS would:
 *
 *   - An `EntityKind` (User, Guild, …) is the ONLY place a collection name
 *     lives. One kind = one collection of one document per entity.
 *   - An `EntityComponent` is a named, schema-typed field that lives *on* an
 *     entity's document. Many components share one document, so reading the
 *     entity loads them all and same-entity writes are single-document atomic.
 *
 * Nothing here talks to MongoDB. `entity()` and `defineComponent()` are thin
 * descriptors (same spirit as `component()`); the storage logic that consumes
 * them lives in `entity-store.ts`.
 */

import type { ZodType } from "zod";

/**
 * A kind of entity — the single place a collection name is named. Everything
 * downstream (handles, components, queries) references the kind, never the raw
 * string, so feature code never spells a collection again.
 */
export interface EntityKind {
  /** MongoDB collection holding one document per entity of this kind. */
  readonly collection: string;
}

/**
 * Declare an entity kind. Entity ids are Discord snowflakes (or synthetic
 * string ids); this descriptor only records where that kind's documents live.
 */
export function entity(collection: string): EntityKind {
  return { collection };
}

/**
 * A component: a named, schema-validated field attached to one entity kind.
 *
 * The `schema` is the single source of truth for the field's shape, defaults
 * (`.default()`), and validation — there is no separate defaults object. `name`
 * is the key under which the value is stored on the entity document, so two
 * components on the same kind must have distinct names.
 *
 * `__t` is a phantom marker (never read at runtime) so TypeScript can recover
 * the value type `T` from any `EntityComponent` reference.
 */
export interface EntityComponent<T> {
  readonly kind: EntityKind;
  readonly name: string;
  readonly schema: ZodType<T>;
  readonly __t?: T;
}

/**
 * Declare a component on an entity kind. The value type is inferred from the
 * schema, so callers never write a generic:
 *
 *   const EventParticipation = defineComponent(User, "eventParticipation",
 *     z.object({ count: z.number().int().min(0).default(0) }));
 *
 * `name` becomes the document field key; keep it stable, since renaming it
 * orphans stored data.
 */
export function defineComponent<T>(
  kind: EntityKind,
  name: string,
  schema: ZodType<T>,
): EntityComponent<T> {
  return { kind, name, schema };
}

/**
 * Parse a component's stored field into its typed value, filling defaults for
 * anything absent. Pass `undefined`/`{}` to get a pure-defaults instance.
 *
 * This is the read boundary: a present-but-malformed stored field throws,
 * because a component schema is the contract for what its collection holds. An
 * *absent* field is not malformed — it parses to defaults, which is how a
 * brand-new entity reads as "has every component at its default value".
 */
export function parseComponentField<T>(component: EntityComponent<T>, raw: unknown): T {
  const parsed = component.schema.safeParse(raw ?? {});
  if (parsed.success) return parsed.data;
  throw new Error(
    `Invalid component "${component.name}" in ${component.kind.collection}: ${parsed.error.message}`,
  );
}
