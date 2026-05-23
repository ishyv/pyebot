# Plan 04 — Split the 722-line guild schema by domain

## Goal

Make the guild config model navigable by splitting `guild.ts` into per-domain modules, **with the
parsed output byte-for-byte identical** — defaults are product behaviour and must not change.

## Context / Why

`src/db/schemas/guild.ts` is 722 lines and mixes every guild-config concern. `AutomodSchema` alone
is `:254-440` (~186 lines). It is hard to navigate and a merge-conflict magnet (the active
uncommitted work already touches it). `docs/codebase-audit.md:15` flags guild-schema defaults as
**product behaviour**, so this is a pure move: no default may change.

## Files touched

- New: `src/db/schemas/guild/automod.ts`, `guild/moderation.ts`, `guild/economy.ts`
  (and optionally `guild/roles.ts`, `guild/channels.ts`).
- `src/db/schemas/guild.ts` — becomes a thin composition root: import the sub-schemas and assemble
  `GuildSchema` (`:515+`) exactly as today; re-export the public schema/type names so importers are
  unaffected.

## Tasks

1. Move `AutomodSchema` and its sub-schemas (`TempRole*`, `PerUserSlow*`, `:156-440`) to
   `guild/automod.ts`. Move `ModerationConfigSchema` + `EscalationThresholdSchema` (`:441-514`) to
   `guild/moderation.ts`. Move economy sub-schemas (`DailyConfigSchema`, `WorkConfigSchema`, etc.,
   `:24-44` + the economy block) to `guild/economy.ts`.
2. Keep all `export` names identical; have `guild.ts` re-export them (`export * from "./guild/automod"`)
   so no call-site import changes.
3. **Collapse default duplication while moving** (only if trivially safe): `DailyConfigSchema`/
   `WorkConfigSchema` defaults are restated inline in `GuildSchema` defaults (`:24-44` vs the
   composition). Reference the sub-schema's own default instead of re-typing it. Skip any case where
   equivalence isn't obvious — correctness over tidiness here.
4. Add a round-trip equality test (see verification) **before** moving, so it guards the move.

## Risks

- **Low**, *if* behaviour-preserving. The one real risk is silently altering a default during the
  move or the dedup in task 3. The round-trip test is the guard; do task 3 conservatively.

## Verification

```bash
bun test src/db/schemas        # includes schemas.test.ts, guild.admin-panels.test.ts
bun run typecheck
bun run check
```
- New test: take a representative full guild document (and an empty `{ _id }`), `GuildSchema.parse`
  it before and after the split, and assert deep-equality of the two parsed results. This proves no
  default or shape changed.
