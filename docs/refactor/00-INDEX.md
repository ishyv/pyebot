# Refactor Plans — Index

This folder holds focused, high-reward refactor plans produced by the 2026-05-22 codebase audit.
Each plan is independent and self-contained (Goal / Files / Tasks / Risks / Verification). They are
ordered by suggested execution sequence, but most can be picked up in isolation.

These plans **align with existing project decisions** in `docs/codebase-audit.md`,
`docs/storage.md`, and `docs/decision-log.md`. Where the initial audit conflicted with those, it was
corrected — see "Alignment notes" below.

> **Status reconciliation (2026-05-25).** The Status column below was re-verified directly against
> the code on this date — the original priorities (`Now`/`Later`) were stale. **All plans are now
> resolved** (06 and 09 completed this date; 09b closed as not-applicable after a data-model
> review — see the decision log). The plan files are kept as historical records of *why* each
> change was made, not as open work.

## Plans

| # | Plan | Theme | Status (verified 2026-05-25) |
|---|------|-------|------------------------------|
| 01 | [Framework cleanup](01-framework-cleanup.md) | Dead method + doc/code drift | **Done** — `ComponentRouter.dispatch()` removed (`router.ts`); `storage.md` reconciled to `@/framework/storage`. |
| 02 | [`find()` parse isolation](02-find-parse-isolation.md) | DB robustness | **Done** — `find()` uses `parseDocuments()` (`store.ts:36-55`), skipping bad rows with a warn; single-doc reads stay strict. |
| 03 | [Type the user-doc bags](03-type-user-bags.md) | Superseded by component ownership | **Done** (superseded by canonical components). |
| 04 | [Split the guild schema](04-split-guild-schema.md) | Data-model readability | **Done** — `guild.ts` is 190 lines; sub-schemas live in `db/schemas/guild/{automod,economy,moderation}.ts`. |
| 05 | [Clarify the money model](05-money-model.md) | Superseded by UserCurrency canonical decision | **Done** (superseded; see 2026-05-24 decision-log entry). |
| 06 | [Response + DB-error helpers](06-response-helpers.md) | Repetition | **Done** — `successMessage`/`failureMessage`/`configUpdateMessage` (`ui/v2.ts`) and `handleDbError` (`core/responseHelpers.ts`) in use; all command `execute` paths migrated to `ctx.respond` (2026-05-25). Sole intentional hold-out: `ai/commands/context.ts` (public `followUp` + ephemeral defer). |
| 07 | [Automod command decomposition](07-automod-decomposition.md) | Superseded | **Done** (superseded; subcommands split under `automod/commands/subcommands/`). |
| 08 | [Split the webapp bridge](08-bot-bridge-split.md) | Superseded | **Done** (superseded). |
| 09 | [Robustness hardening](09-hardening.md) | Robustness | **Done** — 9a (bounded `SessionManager`), 9c (`requiresAdmin` gate), 9d (validated env, `core/env.ts`), 9e (`MessageFlags.Ephemeral`) implemented. 9b **closed as not-applicable**: every `expiresAt` drives a role-removal sweep (TTL would orphan the role) and there is no user-deletion path — see decision-log 2026-05-25. |

## Alignment notes (do not re-litigate)

- **Storage adapters are intentional** ("starter utilities for now", `docs/codebase-audit.md:13-14`).
  Plan 01 reconciles doc/code drift; it does **not** delete them.
- **Strict parse-fail on malformed config is deliberate** (`docs/codebase-audit.md:15-17`). Plan 02
  is scoped only to batch `find()` over non-config collections.
- **Prefer in-feature splits over generic frameworks** (`docs/codebase-audit.md:8-10`). Plans 06–08
  use small local helpers / per-feature modules, not a new abstraction layer.
- **`tx` is latest-only** (`docs/codebase-audit.md:19-23`): never add bridges/shims for old shapes.
  New schemas (plan 03) should fail on malformed legacy data, not normalize it.
- `middleware.ts` naming and the `defineFeature` descriptor boundary are settled — left as-is.

## Global verification (every plan)

```bash
bun run typecheck
bun test            # ~88 test files; run the touched subset during dev
bun run check       # biome format + lint
```

## Open decisions

1. ~~**Money model** (plan 05)~~ — resolved 2026-05-24. `UserCurrency` is canonical; legacy
   user-document money fields are no longer runtime schema.
2. ~~**Multi-guild scope** (plan 03)~~ — resolved 2026-05-25: tx-v2 is **single-community**, so
   global per-user keying for economy/RPG is intentional and moderation stays guild-scoped via
   `sanction_history.<guildId>`. No re-keying migration needed. See the decision log.
3. ~~**Storage adapters** (plan 01)~~ — resolved: the "re-doc" option was taken. `storage.md`
   documents the adapters as imported from `@/framework/storage`, deliberately **not** in the
   public `@/framework` barrel.
