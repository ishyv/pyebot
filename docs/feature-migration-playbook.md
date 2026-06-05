# Feature State Migration Playbook

A general, reusable guide for migrating **one** feature's per-entity *state* from
the legacy storage surfaces to the entity-component model. It is written so that
several agents can each pick a different migration unit and work **in parallel**,
coordinating only through the shared checklist at [`/MIGRATIONS.md`](../MIGRATIONS.md).

Read this whole file once before starting. Then read
[`docs/entity-components.md`](./entity-components.md) (the target API) and
[`docs/entity-vs-config-storage.md`](./entity-vs-config-storage.md) (what is in
scope and what is not).

## 0. The rules (non-negotiable)

1. **Claim before you code.** Your *first* action is to open `/MIGRATIONS.md`, set
   your unit's status to `🚧 in-progress` with your name/date, and **commit that one
   line**. This is how other agents know the unit is taken. Skipping this risks two
   agents migrating the same unit.
2. **Only migrate STATE, never CONFIG.** Config = admin-tunable settings edited in
   the `/admin` panel (`defineFeatureConfig`, guild-document slices). The one-line
   test: *if a server admin edits it in a panel, it's config — leave it alone; if
   feature code reads it by its compile-time type, it's state — migrate it.*
3. **One unit per migration.** Keep the diff to the unit's own files plus
   append-only edits to the two shared files (§5). Never touch another unit's files
   or another row in `/MIGRATIONS.md`.
4. **Code-only, no backfill.** Repoint code to the entity model; do **not** write a
   data-backfill script. Existing rows in the old collection are abandoned. This is
   acceptable because the live DB is near-empty of user data — but it means a
   migration is a behavior-preserving *code* change, not a data move. State this in
   your commit.
5. **Green before done.** `bun run typecheck`, `bun run check`, and `bun test` must
   pass before you mark the unit `✅ done`.

## 1. Understand the unit before changing it

Find where the feature's state lives. There are **two** legacy surfaces:

- **Framework components** — `component({ collection, schema })` in
  `src/components/*.ts`, accessed with `ctx.get/ensure/patch/set/delete/query`.
- **`MongoStore` repositories** — `new MongoStore("collection", Schema)` in
  `src/db/repositories/*`, usually wrapped in helper functions
  (`addBannedImage(...)`, `getGuild(...)`) and sometimes called from the webapp
  bridge (`src/webapp/bot-bridge/*`).

For each piece of state, answer:

- **What entity owns it?** Look at the id passed in. `userId` → `User`; `guildId` →
  `Guild`; `channelId` → a `Channel` kind; a synthetic id (a listing id, a grant
  id, a ticket id) → a new entity kind named for that thing. This decides the
  component's entity kind.
- **Any special handling?** Optimistic-concurrency `version` fields, multi-entity
  atomic writes (these need `ctx.transaction`), repository helper functions, webapp
  bridge call sites, and tests/mocks that reference the old collection.

Reuse the existing Zod schema verbatim — the storage layout is identical, so the
schema does not change. Do not redesign the data shape during a storage migration.

## 2. The migration recipe

Per state component:

1. **Entity kind.** Reuse `User`/`Guild` from `src/components/entities.ts`. Add a
   new kind only if the id space is genuinely new (e.g. `MarketListing`,
   `Ticket`) — append it to `entities.ts` with a doc comment.
2. **Declare the component.** Create `src/components/<feature>/<name>.ts`:
   ```ts
   export const RpgProfile = defineComponent(User, "rpgProfile", RpgProfileSchema);
   export type RpgProfileValue = z.infer<typeof RpgProfile.schema>;
   ```
   Reuse the original schema. The second argument is the field name on the entity
   document — a stable camelCase noun (`"currency"`, `"rpgProfile"`, `"factory"`).
3. **Repoint access** (mechanical map):
   | Legacy | Entity model |
   |---|---|
   | `ctx.get(id, X)` (nullable) | `ctx.of(K, id).peek(X)` |
   | `ctx.ensure(id, X)` (defaulted) | `ctx.of(K, id).get(X)` |
   | `ctx.patch(id, X, p)` | `ctx.of(K, id).update(X, p)` |
   | `ctx.set(id, X, v)` | `ctx.of(K, id).set(X, v)` |
   | `ctx.delete(id, X)` | `ctx.of(K, id).remove(X)` |
   | `ctx.query(X, {sort})` | `ctx.select(X).sortDesc(c => …).limit(n).run()` |
   | multi-entity atomic write | `ctx.transaction(tx => { tx.of(K, a)…; tx.of(K, b)… })` |
   For a `MongoStore` repository, rewrite the helper functions' bodies to use the
   entity API (keep their signatures so callers don't change), then retire the
   store. Background/non-interaction code uses `world.entities` directly.
4. **Delete the legacy definition** once `grep` shows zero references — the
   `component()` file + its `src/components/index.ts` export, or the repository.
5. **Update `scripts/reset-accounts.ts`.** Remove the now-dead collection from its
   list; the state now lives on the entity document (the `users` doc, etc.), so the
   old collection will no longer be written.
6. **Update tests.** Hand-rolled `Ctx` mocks need `of`/`select`/`transaction` stubs
   (copy the throwing-stub pattern already in `src/features/*/**.test.ts`). Update
   any assertion that named the old collection.

## 3. Quality bar — how the result should read

- Match the surrounding file's style and the conventions in
  [`AGENTS.md`](../AGENTS.md). New code should be indistinguishable from a careful
  teammate's.
- JSDoc every exported component/function explaining *why*, an invariant, or a
  boundary — never restating the code.
- No AI tells: no defensive `try/catch`, no comments narrating the obvious, surgical
  diffs only (don't reformat untouched lines).
- The migrated feature should read **more** directly than before — fewer
  collections, typed entity access, same behavior.

## 4. Verify before marking done

- `bun run typecheck` → clean.
- `bun run check` → clean (run `bun run fmt` if it only wants formatting).
- `bun test` → all pass.
- `grep` confirms zero references to the deleted component/collection.
- Optional but encouraged: extend `scripts/entity-smoke.ts` with a round-trip of
  one migrated component against the live replica set.

## 5. Parallel-safety: the shared files

Only two files are touched by every migration. Keep edits minimal and
**append-only** so concurrent migrations rarely conflict:

- `src/components/entities.ts` — add a new entity kind only when needed.
- `src/components/index.ts` — remove the migrated legacy export, add the new one.

Two user-state units both add fields to the **same `users` document** — that is
fine and expected (different fields, atomic per-field writes, no contention). If you
hit a trivial merge conflict in these two files, resolve it by keeping both sides.

## 6. Finishing

1. Commit the migration (one unit = one or a few coherent commits;
   `refactor(<feature>): migrate <thing> to the entity model`).
2. Set your unit's row in `/MIGRATIONS.md` to `✅ done` with the date and commit.
3. Leave every other row untouched.

## 7. Worked micro-example — `UserCurrency`

**Before** (`src/components/user-currency.ts` + `src/features/economy/mutations.ts`):
```ts
export const UserCurrency = component({ collection: "user_currencies", schema: WalletSchema });
// …
const wallet = await ctx.ensure(userId, UserCurrency);
await ctx.patch(userId, UserCurrency, (w) => ({ balances: { ...w.balances, coins } }));
```

**After** (`src/components/economy/currency.ts` + same call sites):
```ts
export const UserCurrency = defineComponent(User, "currency", WalletSchema);
// …
const u = ctx.of(User, userId);
const wallet = await u.get(UserCurrency);
await u.update(UserCurrency, (w) => ({ balances: { ...w.balances, coins } }));
```
The `user_currencies` collection is retired; the wallet now lives at
`users.currency`. No data is carried over (rule §0.4).
