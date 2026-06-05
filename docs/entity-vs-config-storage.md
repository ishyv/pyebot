# Entity State vs Guild Config — a storage decision record

This explains why the bot keeps **two** separate persistence concerns instead of
folding one into the other, so future work doesn't re-litigate it.

## The two systems

| | Entity components | Config system |
|---|---|---|
| Purpose | per-entity **state** | admin-**tunable** settings |
| Declared | `defineComponent(kind, name, schema)` | `defineFeatureConfig({ fields })` |
| Accessed | `ctx.of(kind, id).get(Component)` — typed | dot-path on the guild doc (`getConfigPathValue`, `updateGuildPaths`) |
| Storage | one document per entity, components as fields | the guild document (`guildStore` / `GuildSchema`) |
| UI | none (feature code) | one generic `/admin` panel renders every feature's fields |
| Files | `src/framework/entity*.ts` | `src/core/featureConfig.ts`, `src/features/adminPanels/**` |

## Why they are not merged

We considered absorbing guild config into the entity-component model (one typed
component per guild slice) and **rejected it**. The config system is not a storage
mechanism competing with entity components — it is a **metadata + UX layer**:

- A feature declares `defineFeatureConfig({ fields: { x: channelConfigField({ path:
  "counting.channelId" }) } })`, and **one generic admin panel** renders, validates,
  and persists every feature's settings with zero per-feature UI code.
- That panel only ever holds a runtime **string path** (`"counting.channelId"`) and a
  value. It has no compile-time component reference and is deliberately generic.

The entity model is **typed by design** (`get(Component)`), which is its whole value.
Bridging the panel's string paths to typed components would require a runtime
string→component registry **and** generic deep-path writes (`update("a.b.c", v)`) — i.e.
re-introducing the exact Mongo-path access the typed model exists to remove. So the
config system stays on the guild document, and entity components are used for state.

The distinction in one line: **if a server admin edits it in a panel, it's config; if
feature code reads it by type, it's state.**

## Cleanups done alongside this decision

The audit that produced this decision also fixed real debt:

- **Deleted dead components** `GuildAi`, `GuildAutomod`, `GuildChannels` — declared but
  never used; the real config lives on the guild doc.
- **Consolidated economy config** onto the guild document's `economy` slice and deleted
  the redundant `GuildEconomy` (`guild_economy`) component, which duplicated
  `daily`/`work`/`sectors` in a separate collection. `GuildFeatures` (`guild_features`)
  stays — it is active, standalone, and has no guild-doc duplicate.
- **Rewrote `scripts/reset-accounts.ts`**, which targeted a `users` document and
  camelCase collections that never existed.

## Status of the entity model

Built, unit-tested, and verified against the live replica set
(`scripts/entity-smoke.ts`, 12/12). It currently has no production consumers — its
first real use will be the next feature that needs per-entity state. `guildStore` and
the config system are unchanged and remain the home for guild configuration.

## Deferred

A separate effort will revisit the config system's **own** ergonomics — the
`defineFeatureConfig` authoring API and especially the admin-panel UX
(`src/features/adminPanels/panels/featureConfig.ts`) — to make it more
understandable and to broaden adoption (only `counting` and `example` declare
configs today, though many guild slices are admin-edited through bespoke command
code that could fold into the config system). That is about improving the config
system, not replacing it.
