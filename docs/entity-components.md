# Entity Components

The entity-component model lets you think *"this is the data I want to store on
this entity"* and nothing else — no collection names, no `_id`, no Mongo
operators. It is the entity-centric evolution of the original `component()`
surface, and it coexists with it: existing `component()` data keeps working
unchanged.

Mental model: a **kind** of entity (User, Guild, …) owns one document per
entity. A **component** is a named, schema-typed field that lives *on* that
document. Many components share one document, so reading an entity loads them
all at once and same-entity writes are atomic.

## Declaring a component

A component is one Zod schema attached to an entity kind. The schema is the
single source of truth for shape, defaults (`.default()`), and validation —
there is no second copy of the structure.

```ts
// src/components/event-participation.ts
import { z } from "zod";
import { defineComponent } from "@/framework";
import { User } from "@/components/entities";

export const EventParticipation = defineComponent(User, "eventParticipation",
  z.object({
    count: z.number().int().min(0).default(0),
    lastAt: z.coerce.date().nullable().default(null),
  }),
);

export type EventParticipationValue = z.infer<typeof EventParticipation.schema>;
```

That is the whole "schema in the database": no collection string, no migration,
no repository. `"eventParticipation"` is the field key on the User document —
keep it stable, since renaming it orphans stored data.

Entity kinds live in [`src/components/entities.ts`](../src/components/entities.ts).
Add a kind only for a genuinely distinct class of entity (a synthetic
market-listing id, say); to attach more data to users you add a *component*, not
a kind.

## Reading and writing

`ctx.of(kind, id)` opens a handle to one entity.

```ts
const u = ctx.of(User, userId);

await u.get(EventParticipation);    // defaulted value; a new user reads { count: 0, lastAt: null }
await u.peek(EventParticipation);   // T | null — null until the component is stored
await u.has(EventParticipation);    // boolean

// the motivating example — one line:
await u.update(EventParticipation, (p) => ({ count: p.count + 1 }));

await u.set(EventParticipation, { count: 0, lastAt: null }); // wholesale replace
await u.remove(EventParticipation);                          // drop just this component
```

- **`get` never returns null.** A brand-new entity reads every component at its
  default value — that is the ECS "an entity conceptually has the component"
  model and removes the `?? defaultValue` dance. Use `peek`/`has` when "does
  this exist yet?" genuinely matters.
- **`update` takes a partial or a function** of the current value. The function
  form is the read-modify-write path and sees prior writes made through the same
  `ctx` within one interaction.
- Reads coalesce: the first component read of an entity loads its whole
  document; later reads of any component on that same entity, in the same
  interaction, are free and see your writes.

## Leaderboards

`ctx.select(component)` queries one component across all entities of its kind.
Sort by *reading* a field rather than naming a Mongo path; results are
`{ id, value }` rows.

```ts
const top = await ctx
  .select(UserCurrency)
  .sortDesc((c) => c.balances.coins)
  .limit(10)
  .run();

for (const { id, value } of top) {
  // id is the user snowflake; value is the parsed component
}
```

(It is named `select`, not `query`, only because the legacy `component()` query
still owns `ctx.query`.)

## Transactions

`ctx.transaction(fn)` runs a closure inside a MongoDB transaction. Handles from
`tx.of(...)` share one session, so every write commits or rolls back together.

```ts
await ctx.transaction(async (tx) => {
  await tx.of(User, buyerId).update(UserCurrency, (w) => ({
    balances: { ...w.balances, coins: w.balances.coins - price },
  }));
  await tx.of(User, sellerId).update(UserCurrency, (w) => ({
    balances: { ...w.balances, coins: w.balances.coins + price },
  }));
});
```

Requires a replica set, like the marketplace already does. Note that two
components on the *same* entity update one document atomically without needing a
transaction at all — only cross-entity atomicity needs this.

## Storage layout

One document per entity, components as namespaced fields:

```jsonc
// collection "users"
{ "_id": "<snowflake>",
  "currency":          { "balances": { "coins": 1200 } },
  "eventParticipation":{ "count": 7, "lastAt": "2026-06-04T..." } }
```

For leaderboards, add an index on the namespaced path
(`users` → `currency.balances.coins`).

## When to use which

- **Entity components** (this doc) for per-entity **state**: runtime data that
  feature code reads/writes by its compile-time type (a counter, a streak, a
  cached flag). Default to this for new state.
- **Legacy `component()`** (`src/components/*` with a `collection`) is the
  original surface; existing instances keep working. There is no automated
  migration — components move over deliberately, one at a time, when touched.
- **NOT for admin config.** Admin-*tunable* settings (the stuff a server owner
  edits in the `/admin` panel) belong to the **config system**
  (`defineFeatureConfig` + `src/core/featureConfig.ts`), stored as dot-paths on
  the guild document. That system is a metadata/UX layer, not storage, and is
  deliberately path-addressed so one generic panel can render every feature's
  settings. Don't model config as entity components — see
  [`docs/entity-vs-config-storage.md`](./entity-vs-config-storage.md) for why the
  two systems are kept separate.

See [`src/framework/entity.ts`](../src/framework/entity.ts),
[`entity-store.ts`](../src/framework/entity-store.ts), and
[`entity-handle.ts`](../src/framework/entity-handle.ts) for the implementation.
