/**
 * The entity-component access surface (`of` / `select` / `transaction`),
 * decoupled from any Discord `Client` or interaction.
 *
 * Entity reads and writes only ever need an `EntityStore` (a `Db`) and, for
 * transactions, a Mongo session — never the gateway `Client`. Keeping the
 * surface here, rather than inlined in `InteractionCtx`, lets two callers share
 * one implementation:
 *   - the per-interaction `Ctx` (the bot), which delegates to `createEntityContext`;
 *   - headless tooling (the CLI, scripts) via `headlessEntityContext()`, which
 *     has no `Client` and shouldn't have to fabricate one to touch the database.
 */

import { getDb, getMongoClient } from "@/core/db";
import type { EntityComponent, EntityKind } from "./entity";
import { EntityCache, EntityHandle, EntityQuery } from "./entity-handle";
import { EntityStore } from "./entity-store";
import type { Entity, Transaction } from "./types";

/**
 * The minimal entity surface. A full `Ctx` structurally satisfies this, so
 * feature code that only needs entity access can accept an `EntityContext` and
 * be callable from both an interaction handler and headless tooling.
 */
export interface EntityContext {
  of(kind: EntityKind, id: Entity): EntityHandle;
  select<T>(component: EntityComponent<T>): EntityQuery<T>;
  transaction<R>(fn: (tx: Transaction) => Promise<R>): Promise<R>;
}

/**
 * Build an entity surface over one `EntityStore`. Reads coalesce through a
 * single request-scoped cache (the first component read of an entity loads its
 * whole document; later reads are free and see prior writes). A transaction
 * gets its own session-scoped cache, rebuilt on each `withTransaction` retry so
 * a retry never reads a prior attempt's snapshot.
 */
export function createEntityContext(entities: EntityStore): EntityContext {
  let cache: EntityCache | null = null;
  return {
    of(kind, id) {
      cache ??= new EntityCache(entities);
      return new EntityHandle(entities, cache, kind, id);
    },
    select(component) {
      return new EntityQuery(entities, component);
    },
    async transaction(fn) {
      const client = await getMongoClient();
      const session = client.startSession();
      try {
        let result!: Awaited<ReturnType<typeof fn>>;
        await session.withTransaction(async () => {
          const txCache = new EntityCache(entities, session);
          const tx: Transaction = {
            of: (kind, id) => new EntityHandle(entities, txCache, kind, id, session),
            select: (component) => new EntityQuery(entities, component, session),
          };
          result = await fn(tx);
        });
        return result;
      } finally {
        await session.endSession();
      }
    },
  };
}

/**
 * Entity access for code that runs outside the bot process (CLI, one-off
 * scripts): no `Client`, no interaction — just the database. Connects lazily
 * via `getDb()`.
 */
export async function headlessEntityContext(): Promise<EntityContext> {
  return createEntityContext(new EntityStore(await getDb()));
}
