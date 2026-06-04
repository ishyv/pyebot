/**
 * The developer-facing surface of the entity-component model: the per-entity
 * `EntityHandle` (`ctx.of(kind, id)`), the cross-entity `EntityQuery`
 * (`ctx.select(component)`), and the per-interaction document cache they share.
 *
 * This is the layer features actually touch. It speaks only entities and
 * components — no collection strings, no `_id`, no Mongo operators. The cache
 * keeps the "one fetch loads all of an entity's components" promise: the first
 * component read of an entity loads its whole document, and every later read of
 * that entity within the same interaction is free and sees prior writes.
 */

import type { EntityComponent, EntityKind } from "./entity";
import { parseComponentField } from "./entity";
import {
  type EntityDoc,
  type EntityQueryRow,
  type EntityStore,
  selectorPath,
} from "./entity-store";
import type { Entity } from "./types";

/**
 * Request-scoped cache of entity documents. One per interaction, owned by the
 * Ctx and shared across every handle it hands out, so reads coalesce and writes
 * stay visible to later reads.
 *
 * Coherence rule: a document is kept cached only when the cache holds the
 * *complete* document — loaded via `load` or returned whole by an update. A
 * write that knows only one field (a `set` on an entity whose full document was
 * never loaded) leaves the entry absent rather than caching partial knowledge
 * that would make other components read as missing.
 */
export class EntityCache {
  private readonly docs = new Map<string, EntityDoc | null>();

  constructor(private readonly store: EntityStore) {}

  private key(kind: EntityKind, id: Entity): string {
    return `${kind.collection}::${id}`;
  }

  /** Load an entity's full document, memoized for the rest of the interaction. */
  async load(kind: EntityKind, id: Entity): Promise<EntityDoc | null> {
    const key = this.key(kind, id);
    const cached = this.docs.get(key);
    if (cached !== undefined) return cached;
    const doc = await this.store.loadDoc(kind, id);
    this.docs.set(key, doc);
    return doc;
  }

  /** Replace a cached document wholesale (used after an update returns the full doc). */
  replaceDoc(kind: EntityKind, id: Entity, doc: EntityDoc): void {
    this.docs.set(this.key(kind, id), doc);
  }

  /** Reflect a single-field write in the cache without re-reading, when coherent. */
  setField(kind: EntityKind, id: Entity, name: string, value: unknown): void {
    const key = this.key(kind, id);
    const cached = this.docs.get(key);
    if (cached === undefined) return; // unknown full state; next load fetches fresh
    if (cached === null) {
      this.docs.set(key, { _id: id, [name]: value });
      return;
    }
    cached[name] = value;
  }

  /** Reflect a component removal in the cache. */
  removeField(kind: EntityKind, id: Entity, name: string): void {
    const cached = this.docs.get(this.key(kind, id));
    if (cached) delete cached[name];
  }
}

/**
 * A handle to one entity. Cheap and stateless beyond its ids — `ctx.of` mints a
 * fresh one per call, all sharing the Ctx's cache.
 */
export class EntityHandle {
  constructor(
    private readonly store: EntityStore,
    private readonly cache: EntityCache,
    private readonly kind: EntityKind,
    private readonly id: Entity,
  ) {}

  /**
   * Read a component, filling defaults for anything not stored. Never null: a
   * brand-new entity reads as every component at its default value. Use `peek`
   * when "does this exist yet?" actually matters.
   */
  async get<T>(component: EntityComponent<T>): Promise<T> {
    const doc = await this.cache.load(this.kind, this.id);
    return parseComponentField(component, doc?.[component.name]);
  }

  /** Read a component, or null if the entity has never had it stored. */
  async peek<T>(component: EntityComponent<T>): Promise<T | null> {
    const doc = await this.cache.load(this.kind, this.id);
    if (!doc || !(component.name in doc)) return null;
    return parseComponentField(component, doc[component.name]);
  }

  /** Whether this component is stored on the entity, independent of its value. */
  async has<T>(component: EntityComponent<T>): Promise<boolean> {
    const doc = await this.cache.load(this.kind, this.id);
    return doc !== null && component.name in doc;
  }

  /** Replace a component's value wholesale. Prefer `update` for read-modify-write. */
  async set<T>(component: EntityComponent<T>, value: T): Promise<void> {
    await this.store.setComponent(this.id, component, value);
    this.cache.setField(this.kind, this.id, component.name, value);
  }

  /**
   * Patch a component. Pass a partial, or a function of the current (defaulted)
   * value — the function form is the read-modify-write path and sees prior
   * writes within this interaction. The post-write document refreshes the cache.
   */
  async update<T>(
    component: EntityComponent<T>,
    patch: Partial<T> | ((current: T) => Partial<T>),
  ): Promise<void> {
    const partial = typeof patch === "function" ? patch(await this.get(component)) : patch;
    const doc = await this.store.updateComponent(this.id, component, partial);
    this.cache.replaceDoc(this.kind, this.id, doc);
  }

  /** Remove a component from the entity, leaving its other components intact. */
  async remove<T>(component: EntityComponent<T>): Promise<void> {
    await this.store.removeComponent(this.id, component);
    this.cache.removeField(this.kind, this.id, component.name);
  }
}

/**
 * A cross-entity query over one component — the leaderboard surface. Sort by
 * reading a field (`c => c.balances.coins`) rather than naming a Mongo path;
 * results are `{ id, value }` pairs, never raw documents. Not cached: results
 * vary by options and can be large.
 */
export class EntityQuery<T> {
  private sortSpec?: Record<string, 1 | -1>;
  private limitN?: number;
  private skipN?: number;

  constructor(
    private readonly store: EntityStore,
    private readonly component: EntityComponent<T>,
  ) {}

  /** Sort descending by the read field (highest first). */
  sortDesc(selector: (value: T) => unknown): this {
    this.sortSpec = { [`${this.component.name}.${selectorPath(selector)}`]: -1 };
    return this;
  }

  /** Sort ascending by the read field (lowest first). */
  sortAsc(selector: (value: T) => unknown): this {
    this.sortSpec = { [`${this.component.name}.${selectorPath(selector)}`]: 1 };
    return this;
  }

  limit(n: number): this {
    this.limitN = n;
    return this;
  }

  skip(n: number): this {
    this.skipN = n;
    return this;
  }

  /** Execute the query and return id+value rows. */
  run(): Promise<ReadonlyArray<EntityQueryRow<T>>> {
    return this.store.query(this.component, {
      sort: this.sortSpec,
      limit: this.limitN,
      skip: this.skipN,
    });
  }
}
