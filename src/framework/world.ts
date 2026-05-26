/**
 * `World` — the single object that owns all data access in the framework.
 *
 * Conceptually the World is the equivalent of Bevy's `World` struct: it
 * holds every entity, every component, the event bus, and the shared
 * resources. The big difference is storage. Bevy's World keeps components
 * in RAM in cache-friendly archetype arrays; ours stores them in MongoDB,
 * one collection per Component descriptor. Everything else — the
 * developer-facing API, the event dispatch model, the way Components are
 * declared — is Bevy-inspired.
 *
 * Why a single class and not separate read/write services?
 *   - Caching and event dispatch must be coordinated. Splitting them
 *     creates a fence between "I read this, then I patched it, then I
 *     emitted that" that complicates exactly nothing useful.
 *   - Features never construct the World. They receive a Ctx (which is
 *     either the World directly or a small per-interaction view of it).
 *     A single class is the simplest thing that gives us that surface.
 *
 * Two flavors of access:
 *
 *   1. The "root" World is created once at boot. Outside of any
 *      interaction (background jobs, migration scripts) you talk to this
 *      directly. There is no cache — every read hits MongoDB.
 *
 *   2. `world.forInteraction(interaction)` returns a small Ctx that
 *      wraps the World and adds a per-interaction cache. Within one
 *      command handler, `ctx.get(userId, EconomyAccount)` called twice
 *      hits MongoDB once.
 *
 * Caching invariant: when a `patch`/`set`/`delete` happens, the cache is
 * updated in lockstep with the DB write. There is no separate "invalidate"
 * step — the World owns both sides, so it can keep them coherent.
 *
 * No `Result` wrapping. The previous `MongoStore` layer wrapped every
 * operation in `Result<T, Error>`. We do not, here, because:
 *   - 99% of feature code never had a recovery strategy beyond "log and
 *     reply with a generic error" — and that decision belongs at the
 *     interaction boundary, not in every read.
 *   - Wrapping forced features to call `.unwrap()`, `.isErr()`, etc., on
 *     every single line of data access. That is noise.
 * Instead, the World throws on DB failure. The framework's
 * `interactionCreate` handler catches and replies ephemerally. Feature
 * code stays linear and readable.
 */

import type { Client, Interaction } from "discord.js";
import type { Collection, Db, Document, Filter as MongoFilter } from "mongodb";
import { getDb } from "@/core/db";
import { createInteractionResponder, type InteractionResponder } from "@/core/interactionResponder";
import { createLogger, type Logger } from "@/core/logger";
import { cooldowns, locks, sessions } from "@/core/state";
import { EventBus } from "./event-bus";
import type { Component, ComponentRecord, Ctx, Entity } from "./types";

// Helper: identify a cache row for a (collection, id) tuple.
function cacheKey(collection: string, id: Entity): string {
  return `${collection}::${id}`;
}

/**
 * The framework-wide World. Created once at boot via `World.create()`.
 */
export class World {
  private readonly db: Db;
  readonly bus: EventBus;
  readonly client: Client;
  private readonly logger: Logger;

  private constructor(db: Db, client: Client) {
    this.db = db;
    this.bus = new EventBus();
    this.client = client;
    this.logger = createLogger("world");
  }

  /** Create the World, connecting to MongoDB lazily via getDb(). */
  static async create(client: Client): Promise<World> {
    const db = await getDb();
    return new World(db, client);
  }

  /** Get a typed collection handle for a Component. */
  private async col<T>(component: Component<T>): Promise<Collection<Document & { _id: Entity }>> {
    return this.db.collection<Document & { _id: Entity }>(component.collection);
  }

  /** Parse a raw document with the component's schema; malformed stored docs fail loudly. */
  private parse<T>(component: Component<T>, raw: unknown, id: Entity): T {
    const parsed = component.schema.safeParse(raw);
    if (parsed.success) return parsed.data;
    this.logger.error(`Invalid document in ${component.collection} (${id}).`, parsed.error);
    throw new Error(`Invalid ${component.collection} document ${id}`);
  }

  /** Build a defaults instance from the schema (Zod fills `default()`s). */
  private defaults<T>(component: Component<T>, _id: Entity): T {
    const parsed = component.schema.safeParse({});
    if (parsed.success) return parsed.data;
    throw new Error(`Component ${component.collection} cannot build defaults for ${_id}`);
  }

  // ─── Direct (no-cache) operations ──────────────────────────────────────
  // These are used by `forInteraction()`'s cached view, by background jobs,
  // and by the migration script. Most feature code goes through Ctx.

  async getDirect<T>(id: Entity, component: Component<T>): Promise<T | null> {
    const col = await this.col(component);
    const doc = await col.findOne({ _id: id } as MongoFilter<Document & { _id: Entity }>);
    return doc ? this.parse(component, doc, id) : null;
  }

  async ensureDirect<T>(id: Entity, component: Component<T>): Promise<T> {
    const col = await this.col(component);
    const defaults = this.defaults(component, id);
    const res = await col.findOneAndUpdate(
      { _id: id } as MongoFilter<Document & { _id: Entity }>,
      { $setOnInsert: { _id: id, ...(defaults as object) } } as Document,
      { upsert: true, returnDocument: "after" },
    );
    // Driver versions differ on shape; normalize.
    const doc = (res && (res as { value?: unknown }).value) ?? (res as unknown);
    return this.parse(component, doc, id);
  }

  async setDirect<T>(id: Entity, component: Component<T>, value: T): Promise<void> {
    const col = await this.col(component);
    await col.replaceOne(
      { _id: id } as MongoFilter<Document & { _id: Entity }>,
      { _id: id, ...(value as object) } as Document & { _id: Entity },
      { upsert: true },
    );
  }

  async patchDirect<T>(id: Entity, component: Component<T>, patch: Partial<T>): Promise<T> {
    const col = await this.col(component);
    const defaults = this.defaults(component, id);
    const res = await col.findOneAndUpdate(
      { _id: id } as MongoFilter<Document & { _id: Entity }>,
      {
        $setOnInsert: { _id: id, ...(defaults as object) },
        $set: patch as Document,
      } as Document,
      { upsert: true, returnDocument: "after" },
    );
    const doc = (res && (res as { value?: unknown }).value) ?? (res as unknown);
    return this.parse(component, doc, id);
  }

  async deleteDirect<T>(id: Entity, component: Component<T>): Promise<void> {
    const col = await this.col(component);
    await col.deleteOne({ _id: id } as MongoFilter<Document & { _id: Entity }>);
  }

  async queryDirect<T>(
    component: Component<T>,
    options?: {
      filter?: MongoFilter<Document>;
      sort?: Record<string, 1 | -1>;
      limit?: number;
      skip?: number;
    },
  ): Promise<ReadonlyArray<ComponentRecord<T>>> {
    const col = await this.col(component);
    let cursor = col.find((options?.filter as MongoFilter<Document & { _id: Entity }>) ?? {});
    if (options?.sort) cursor = cursor.sort(options.sort);
    if (options?.skip !== undefined) cursor = cursor.skip(options.skip);
    if (options?.limit !== undefined) cursor = cursor.limit(options.limit);
    const docs = await cursor.toArray();
    return docs.map((doc) => {
      const id = doc._id as Entity;
      const parsed = this.parse(component, doc, id);
      return { ...(parsed as object), _id: id } as ComponentRecord<T>;
    });
  }

  /**
   * Build a per-interaction Ctx — a small façade over the World that adds
   * a request-scoped cache. Feature handlers always receive one of these.
   */
  forInteraction(interaction: Interaction | null, featureId = "framework"): Ctx {
    return new InteractionCtx(this, interaction, featureId) as unknown as Ctx;
  }
}

/**
 * Per-interaction view over the World. Caches reads, invalidates on write,
 * tags log output with the feature id. One of these is constructed per
 * interaction and discarded when the interaction completes.
 */
class InteractionCtx implements Ctx {
  private readonly cache = new Map<string, unknown>();
  private responder: InteractionResponder | null = null;
  readonly logger: Logger;

  constructor(
    private readonly world: World,
    public readonly interaction: Interaction | null,
    featureId: string,
  ) {
    this.logger = createLogger(`feature:${featureId}`);
  }

  get client(): Client {
    return this.world.client;
  }

  /** Lazily-built response lifecycle for this interaction. Built once and reused
   * so the deferred/replied state stays coherent across calls within a handler. */
  get respond(): InteractionResponder {
    if (!this.interaction) {
      throw new Error("ctx.respond is unavailable: this Ctx was created without an interaction.");
    }
    this.responder ??= createInteractionResponder(this.interaction);
    return this.responder;
  }
  get cooldowns() {
    return cooldowns;
  }
  get locks() {
    return locks;
  }
  get sessions() {
    return sessions;
  }

  async get<T>(id: Entity, component: Component<T>): Promise<T | null> {
    const key = cacheKey(component.collection, id);
    if (this.cache.has(key)) return this.cache.get(key) as T | null;
    const value = await this.world.getDirect(id, component);
    this.cache.set(key, value);
    return value;
  }

  async ensure<T>(id: Entity, component: Component<T>): Promise<T> {
    const key = cacheKey(component.collection, id);
    const cached = this.cache.get(key);
    if (cached !== undefined && cached !== null) return cached as T;
    const value = await this.world.ensureDirect(id, component);
    this.cache.set(key, value);
    return value;
  }

  async set<T>(id: Entity, component: Component<T>, value: T): Promise<void> {
    await this.world.setDirect(id, component, value);
    this.cache.set(cacheKey(component.collection, id), value);
  }

  async patch<T>(
    id: Entity,
    component: Component<T>,
    patch: Partial<T> | ((current: T) => Partial<T>),
  ): Promise<void> {
    let partial: Partial<T>;
    if (typeof patch === "function") {
      const current = await this.ensure(id, component);
      partial = (patch as (c: T) => Partial<T>)(current);
    } else {
      partial = patch;
    }
    const updated = await this.world.patchDirect(id, component, partial);
    this.cache.set(cacheKey(component.collection, id), updated);
  }

  async delete<T>(id: Entity, component: Component<T>): Promise<void> {
    await this.world.deleteDirect(id, component);
    this.cache.set(cacheKey(component.collection, id), null);
  }

  query<T>(
    component: Component<T>,
    options?: {
      filter?: MongoFilter<Document>;
      sort?: Record<string, 1 | -1>;
      limit?: number;
      skip?: number;
    },
  ): Promise<ReadonlyArray<ComponentRecord<T>>> {
    // `query` results are NOT cached — they vary by options and can be large.
    return this.world.queryDirect(component, options);
  }

  emit<E>(event: E): Promise<void> {
    return this.world.bus.emit(event as object, this);
  }
}
