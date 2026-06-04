# Guild → Entity-Component Migration Plan

> **Status: plan, not yet executed.** Each slice below is its own commit, gated
> on `bun run typecheck`, `bun run check`, `bun test`, and the entity smoke test.
> Work directly on `main`, one slice at a time.

## Context

`guildStore` (`src/db/repositories/guilds.ts`) is a legacy `MongoStore("guilds",
GuildSchema)` that holds *all* live guild config in one document — `{ _id, ai,
automod, channels, economy, moderation, roles, counting, reputation, tops,
offersConfig, forumAutoReply, pendingTickets, nextCaseId, … }`. We are absorbing
it into the entity-component model so guild config is read/written through
`ctx.of(Guild, id).get(Component)` and `guildStore` can be retired.

**Why this is mostly mechanical:** the entity model already stores one document
per entity with components as namespaced fields — which is *exactly* the shape
of the `guilds` document today. A Guild component whose `name` equals an existing
slice key (`"economy"`, `"automod"`, …) reads and writes the *same field of the
same document*. So **native slices need no data migration** — only a component
declaration and call-site moves.

`Guild = entity("guilds")` already exists in `src/components/entities.ts`,
pointing at the live collection.

## Current state (audited against the live DB)

Three storage systems touch guild data:

1. **`guildStore` MongoStore** → the monolithic `guilds` doc. **This holds the
   live data** (1 guild present). `GuildSchema` is `.passthrough()`, so extra
   (entity-component) fields on the doc survive reads. `guildStore.set()` (the
   only whole-doc replace, which would clobber) is **unused**; writes go through
   path-based `patch`/`updatePaths`.
2. **`component()` `guild_*` definitions** — `GuildEconomy`(`guild_economy`),
   `GuildAi`(`guild_ai`), `GuildAutomod`(`guild_automod`),
   `GuildChannels`(`guild_channels`). These are a **stalled earlier split**:
   their collections are **empty** in the live DB, their schemas *differ* from
   the corresponding `GuildSchema` slice, and only a little code points at them
   (`daily.ts` reads `GuildEconomy`; `configMutations.ts` reads/writes it).
   `GuildFeatures`(`guild_features`) is **not** a duplicate — there is no
   `features` slice in `GuildSchema`; it is the sole feature-toggle store and
   has the 1 live doc.
3. **New `defineComponent()` entity model** — unused for guilds so far.

`scripts/reset-accounts.ts` is **stale** — it `$unset`s camelCase fields on a
non-existent `users` doc and deletes camelCase collections that don't exist. It
must be rewritten or retired as part of this work, not used as a reference.

Scale: **143 references across 38 files** (`getGuild`/`ensureGuild`/`patchGuild`/
`updateGuildPaths`/`guildStore`) — moderation, automod, counting, offers, ai,
tickets, adminPanels, and the webapp bridge.

## Design decisions

### Component granularity
One component per existing `GuildSchema` object slice, reusing the slice's
**existing schema** verbatim and naming the component after the field:

| Component (name) | Source schema | Duplicate `guild_*`? |
|---|---|---|
| `roles` | `GuildRolesSchema` | no |
| `channels` | `GuildChannelsSchema` | yes → `guild_channels` |
| `ai` | `AiConfigSchema` | yes → `guild_ai` |
| `automod` | `AutomodSchema` | yes → `guild_automod` |
| `economy` | `EconomyConfigSchema` | yes → `guild_economy` |
| `moderation` | `ModerationConfigSchema` | no |
| `counting` | `CountingConfigSchema` | no |
| `reputation` | `ReputationConfigSchema` | no |
| `tops` | `TopsConfigSchema` | no |
| `offersConfig` | `OffersConfigSchema` | no |
| `forumAutoReply` | `ForumAutoReplySchema` | no |

### Non-object fields
Components hold object values; two `GuildSchema` fields are not objects:
- **`pendingTickets`** (`string[]`) → fold into the `channels` component (it is
  already the ticket-adjacent slice) as `pendingTickets: string[]`, **or** a
  dedicated `tickets` component `{ pending: string[] }`. Decide when reaching the
  channels/tickets slice.
- **`nextCaseId`** (`number`) → fold into the `moderation` component
  (`nextCaseId: number`), since case-id allocation is moderation-owned.
- `createdAt`/`updatedAt`/`_id` are document metadata, not components — they do
  not migrate.

### Duplicate `guild_*` reconciliation (per-slice gate)
For `economy`, `ai`, `automod`, `channels`: before migrating that slice,
confirm the source of truth. The hypothesis (collections empty, live data in the
`guilds` slice) says: **keep the `GuildSchema` slice as the component schema,
delete the abandoned `guild_*` component + collection, and redirect its few
readers** (`daily.ts`, `configMutations.ts`) to the Guild entity component.
⚠️ The schemas differ (e.g. `GuildEconomy` has `daily/work/sectors`;
`EconomyConfigSchema` may differ). Each pair needs a field-level diff so the
redirect does not silently drop or mistype config. **This is the real work of
the duplicated slices** — do not assume the schemas are interchangeable.

### Webapp bridge
`src/webapp/bot-bridge/guild.ts` and `bridge-types.ts` read guild config. They
move to the entity API (or call a thin compatibility shim during the transition).

### reset-accounts.ts
Rewrite to target the real collections and the post-migration `guilds`/user
shape, or split into `reset-guild` / `reset-users`. Cover it with the audit
script (`scripts/entity-audit.ts`) before and after.

## Migration sequence

Ordered to retire risk gradually — clean slices first to prove the pattern,
duplicated slices next (the hard reconciliations), structural fields last,
`guildStore` deletion only when its last reader is gone.

**Phase 0 — scaffolding**
- Add `src/components/guild/` housing one file per Guild component
  (`defineComponent(Guild, "<slice>", <existing slice schema>)`), re-exporting
  the slice schemas from `src/db/schemas/guild/*` (no schema rewrite).
- Extend `scripts/entity-smoke.ts` (or add `guild-smoke.ts`) to exercise a Guild
  component read/write against the live `guilds` doc in an isolated test id.

**Phase 1 — clean slices (no duplicate, no structural quirk)**
`counting` → `reputation` → `tops` → `offersConfig` → `forumAutoReply` →
`roles`. Each: declare component, move its call sites from `getGuild(...).x` /
`patchGuild` / `updateGuildPaths("x.*")` to `ctx.of(Guild, id).get/update(X)`,
delete now-dead guildStore reads for that slice, verify.

**Phase 2 — duplicated slices (source-of-truth reconciliation)**
`ai` → `automod` → `channels` → `economy`. Each: field-diff the `guild_*`
component vs the `GuildSchema` slice, choose the merged schema, redirect the
`guild_*` readers (`daily.ts`, `configMutations.ts`, automod hot paths) to the
Guild component, delete the `guild_*` component file, and drop the (empty)
`guild_*` collection.

**Phase 3 — structural fields**
`moderation` (absorbing `nextCaseId`) and the ticket fields
(`pendingTickets` + the channels ticket fields). These touch case-id allocation
and the tickets feature — highest care.

**Phase 4 — retire guildStore + webapp + scripts**
- Migrate `src/webapp/bot-bridge/guild.ts` + `bridge-types.ts`.
- Delete `src/db/repositories/guilds.ts`, `src/db/schemas/guild.ts` monolith
  (keeping the slice schemas the components now use), and the `guildStore`
  boundary entry in `src/db/mongo-store-boundary.test.ts`.
- Rewrite `scripts/reset-accounts.ts`.

## Per-slice recipe

1. Declare `export const GuildX = defineComponent(Guild, "x", XSchema)` in
   `src/components/guild/x.ts`.
2. Replace reads: `(await getGuild(id)).unwrap()?.x` → `await ctx.of(Guild,
   id).get(GuildX)`. Replace writes: `updateGuildPaths(id, { "x.foo": v })` →
   `ctx.of(Guild, id).update(GuildX, { foo: v })` (or `set`).
3. Delete any `guild_*` component + collection the slice supersedes (Phase 2).
4. `bun run typecheck && bun run check && bun test && bun scripts/entity-smoke.ts`.
5. Commit: `refactor(guild): migrate <slice> to the Guild entity component`.

## Verification

- **Per slice:** typecheck, biome, full test suite, and the entity smoke test
  (extended to cover a real Guild component round-trip on the live replica set).
- **Read-compat:** because `GuildSchema` is `.passthrough()` and the doc shape is
  unchanged, a half-migrated `guilds` doc stays readable by *both* the entity
  component and any not-yet-migrated `guildStore` reader — so slices can land
  independently without a flag-day.
- **Data:** `scripts/entity-audit.ts` before/after each phase to confirm no
  collection unexpectedly appears or empties.

## Risks & rollback

- **Schema drift on duplicated slices** (Phase 2): the only place data semantics
  can silently change. Mitigation: field-level diff + the smoke round-trip per
  slice; no `guild_*` deletion until its readers are redirected and green.
- **`guildStore.set` reintroduction:** if any new code calls it mid-migration it
  would clobber migrated fields. Mitigation: it is currently unused — add a lint
  note / remove the method early in Phase 0.
- **Rollback:** every slice is an isolated commit with no data move (native
  slices) or an empty-collection deletion (duplicated slices), so reverting a
  slice's commit fully restores prior behavior. There is no irreversible backfill
  in this plan.
