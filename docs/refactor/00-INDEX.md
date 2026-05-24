# Refactor Plans — Index

This folder holds focused, high-reward refactor plans produced by the 2026-05-22 codebase audit.
Each plan is independent and self-contained (Goal / Files / Tasks / Risks / Verification). They are
ordered by suggested execution sequence, but most can be picked up in isolation.

These plans **align with existing project decisions** in `docs/codebase-audit.md`,
`docs/storage.md`, and `docs/decision-log.md`. Where the initial audit conflicted with those, it was
corrected — see "Alignment notes" below.

## Plans

| # | Plan | Theme | Risk | Priority |
|---|------|-------|------|----------|
| 01 | [Framework cleanup](01-framework-cleanup.md) | Dead method + doc/code drift | Low | Now |
| 02 | [`find()` parse isolation](02-find-parse-isolation.md) | DB robustness | Low–Med | Now |
| 03 | [Type the user-doc bags](03-type-user-bags.md) | Superseded by component ownership | Med | Done/stale |
| 04 | [Split the guild schema](04-split-guild-schema.md) | Data-model readability | Low | Later |
| 05 | [Clarify the money model](05-money-model.md) | Superseded by UserCurrency canonical decision | Med | Done/stale |
| 06 | [Response + DB-error helpers](06-response-helpers.md) | Repetition | Low–Med | Later |
| 07 | [Automod command decomposition](07-automod-decomposition.md) | Superseded | Med | Done/stale |
| 08 | [Split the webapp bridge](08-bot-bridge-split.md) | Superseded | Med | Done/stale |
| 09 | [Robustness hardening](09-hardening.md) | Robustness | Med | Later |

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

## Open decisions blocking some plans

1. **Money model** (plan 05): resolved on 2026-05-24. `UserCurrency` is canonical; legacy
   user-document money fields are no longer runtime schema.
2. **Multi-guild scope** (plan 03): is per-user data keyed by `guildId` inside the user doc
   intentional (effectively single-guild), or should moderation history be guild-scoped?
3. **Storage adapters** (plan 01): wire `MemoryStorageAdapter`/`FileStorageAdapter` into the
   `@/framework` barrel (match the doc), or update the doc to drop the `@/framework` import claim?
