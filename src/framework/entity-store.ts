/**
 * Entity-document storage — the Mongo side of the entity-component model.
 *
 * One `EntityKind` maps to one collection of documents shaped
 * `{ _id, <componentName>: <value>, … }`. Components are namespaced fields on
 * that single document, so:
 *   - reading an entity loads every component it has in one round-trip;
 *   - writing different components on the same entity touches disjoint paths
 *     and never contends;
 *   - a write seeds only its own component, leaving siblings untouched.
 *
 * `EntityStore` is the entity-model analog of `World`'s `*Direct` methods: it
 * holds no cache and never wraps results in `Result` — it throws on driver
 * failure and lets the interaction boundary catch. The request-scoped cache and
 * the ergonomic `ctx.of(...)` / `ctx.query(...)` surface live one layer up.
 *
 * Every method takes an optional `ClientSession` so the same code path serves
 * both normal writes and `ctx.transaction(...)`.
 */

import type { ClientSession, Db, Document, Filter } from "mongodb";
import { type EntityComponent, type EntityKind, parseComponentField } from "./entity";
import type { Entity } from "./types";

/** A stored entity document: an id plus one field per attached component. */
export type EntityDoc = { _id: Entity } & Record<string, unknown>;

/** A query result row — the entity id and its parsed component value. */
export interface EntityQueryRow<T> {
  readonly id: Entity;
  readonly value: T;
}

/** Sort/paginate options for `EntityStore.query`. Sort keys are namespaced paths. */
export interface EntityQueryOptions {
  readonly filter?: Filter<Document>;
  readonly sort?: Record<string, 1 | -1>;
  readonly limit?: number;
  readonly skip?: number;
}

/**
 * Build the upsert update for a component-scoped patch.
 *
 * This is the entity-document analog of `buildPatchUpdate` in `world.ts`: it
 * solves the same MongoDB ConflictingUpdateOperators (error 40) problem, where
 * a field present in both `$set` and `$setOnInsert` is rejected at parse time.
 * Every component field carries a Zod default, so insert-defaults always
 * overlap the caller's patch unless we deduplicate.
 *
 * The only difference from the original is namespacing: instead of writing
 * top-level keys, both the patch and the seeded defaults are written under
 * `<name>.<key>` so they land inside the component's sub-document. The patch
 * wins — any key it sets is dropped from the seeded defaults. An empty patch
 * yields an update with no `$set` (MongoDB rejects an empty `$set`), behaving
 * like a pure ensure of the entity document and its component defaults.
 */
export function buildComponentUpdate(
  id: Entity,
  name: string,
  defaults: Record<string, unknown>,
  patch: Record<string, unknown>,
): Document {
  const setOnInsert: Record<string, unknown> = { _id: id };
  for (const [key, value] of Object.entries(defaults)) {
    if (!(key in patch)) setOnInsert[`${name}.${key}`] = value;
  }
  const update: Document = { $setOnInsert: setOnInsert };
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) set[`${name}.${key}`] = value;
  if (Object.keys(set).length > 0) update.$set = set;
  return update;
}

const PATH = Symbol("entity-selector-path");

/**
 * Resolve a property-access selector into a dotted field path.
 *
 * Lets the query surface express a sort/field by reading it
 * (`c => c.balances.coins`) instead of spelling the Mongo string
 * `"balances.coins"`. The selector runs against a Proxy that records each
 * property access; the recorded chain is the path. Throws if the selector
 * reads nothing, which would otherwise sort by an empty path.
 */
export function selectorPath<T>(selector: (value: T) => unknown): string {
  const result = selector(makePathProxy([]) as T);
  const path = (result as { [PATH]?: readonly string[] })?.[PATH];
  if (!path || path.length === 0) {
    throw new Error("entity query selector must read at least one property");
  }
  return path.join(".");
}

function makePathProxy(path: readonly string[]): unknown {
  return new Proxy(
    { [PATH]: path },
    {
      get(_target, prop) {
        if (prop === PATH) return path;
        if (typeof prop === "symbol") return undefined;
        return makePathProxy([...path, prop]);
      },
    },
  );
}

/**
 * Per-kind Mongo access for the entity-component model. Construct once (the
 * `World` owns the singleton) and share across interactions; it is stateless
 * beyond the `Db` handle.
 */
export class EntityStore {
  constructor(private readonly db: Db) {}

  private col(kind: EntityKind) {
    return this.db.collection<EntityDoc>(kind.collection);
  }

  /** Load an entity's full document (all its components) or null if it has none. */
  loadDoc(kind: EntityKind, id: Entity, session?: ClientSession): Promise<EntityDoc | null> {
    return this.col(kind).findOne({ _id: id } as Filter<EntityDoc>, { session });
  }

  /** Replace one component's value wholesale, creating the entity document if absent. */
  async setComponent<T>(
    id: Entity,
    component: EntityComponent<T>,
    value: T,
    session?: ClientSession,
  ): Promise<void> {
    await this.col(component.kind).updateOne(
      { _id: id } as Filter<EntityDoc>,
      { $set: { [component.name]: value }, $setOnInsert: { _id: id } },
      { upsert: true, session },
    );
  }

  /**
   * Apply a partial patch to one component, seeding defaults on insert. Returns
   * the entity document after the write so callers can refresh a cache without
   * a second read.
   */
  async updateComponent<T>(
    id: Entity,
    component: EntityComponent<T>,
    patch: Partial<T>,
    session?: ClientSession,
  ): Promise<EntityDoc> {
    const defaults = parseComponentField(component, {}) as Record<string, unknown>;
    const update = buildComponentUpdate(
      id,
      component.name,
      defaults,
      patch as Record<string, unknown>,
    );
    const res = await this.col(component.kind).findOneAndUpdate(
      { _id: id } as Filter<EntityDoc>,
      update,
      { upsert: true, returnDocument: "after", session },
    );
    // Driver versions disagree on the result shape; normalize as world.ts does.
    return ((res && (res as { value?: unknown }).value) ?? res) as EntityDoc;
  }

  /** Remove one component from an entity, leaving its other components intact. */
  async removeComponent<T>(
    id: Entity,
    component: EntityComponent<T>,
    session?: ClientSession,
  ): Promise<void> {
    await this.col(component.kind).updateOne(
      { _id: id } as Filter<EntityDoc>,
      { $unset: { [component.name]: "" } },
      { session },
    );
  }

  /** Whether an entity has a given component stored (independent of its value). */
  async hasComponent<T>(
    id: Entity,
    component: EntityComponent<T>,
    session?: ClientSession,
  ): Promise<boolean> {
    const doc = await this.col(component.kind).findOne(
      { _id: id, [component.name]: { $exists: true } } as Filter<EntityDoc>,
      { projection: { _id: 1 }, session },
    );
    return doc !== null;
  }

  /**
   * Cross-entity read of one component — the leaderboard path. Only documents
   * that actually carry the component are returned; each value is parsed
   * through the component schema (the read boundary).
   */
  async query<T>(
    component: EntityComponent<T>,
    options: EntityQueryOptions = {},
    session?: ClientSession,
  ): Promise<ReadonlyArray<EntityQueryRow<T>>> {
    const filter = {
      [component.name]: { $exists: true },
      ...(options.filter ?? {}),
    } as Filter<EntityDoc>;
    let cursor = this.col(component.kind).find(filter, { session });
    if (options.sort) cursor = cursor.sort(options.sort);
    if (options.skip !== undefined) cursor = cursor.skip(options.skip);
    if (options.limit !== undefined) cursor = cursor.limit(options.limit);
    const docs = await cursor.toArray();
    return docs.map((doc) => ({
      id: doc._id,
      value: parseComponentField(component, doc[component.name]),
    }));
  }
}
