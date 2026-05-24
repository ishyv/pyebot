# Decision Log

## 2026-05-24 - RPG state canonical components

**Cambio:** RPG runtime state no longer uses embedded `users` document fields.
`RpgProfile` owns profile/loadout/fight state, `UserInventory` owns item stacks,
and `UserCurrency` owns RPG coin fees and balances. The legacy RPG repository
and embedded user-schema fields were removed from the runtime model.

**Motivo:** `users` had become a mixed document for moderation, RPG, economy,
tickets, minigames, and voting. That created split-brain state where economy
market code used components while RPG crafting, processing, gathering, hideout,
quests, and combat still read `users.inventory`, `users.currency`, or
`users.rpgProfile`.

**Alternativas:** Runtime dual-read migration and compatibility shims were
rejected. This repo is latest-only; existing stale Mongo fields can remain
physically present until a separate destructive cleanup script is requested, but
runtime code must not model or read them.

**Riesgos:** Existing persisted legacy RPG state is not auto-migrated. Servers
that still only have the old embedded fields need an explicit migration if that
data must be preserved.

**Cómo verificar:** Run `bun test src/db src/features/rpg src/features/economy`,
`bun run typecheck`, targeted Biome on touched files, `git diff --check`, and
`bun run start` to confirm loader, login, webapp bind, and command registration.

## 2026-05-24 - Main-only workflow rule

**Cambio:** Project work should stay on `main` by default. Agents must not create,
switch to, or keep feature branches unless the user explicitly asks for a branch.
Use coherent commits along the way instead of branch ceremony.

**Motivo:** This repo already uses local checkpoints and direct mainline work for
small, scoped changes. Extra branches have caused cleanup noise, especially with
the nested `webapp/` repository boundary.

**Alternativas:** Feature branches remain available only when explicitly
requested. They are not the default workflow.

**Riesgos:** Larger risky rewrites need stricter commit checkpoints and focused
verification because rollback is commit-based, not branch-based.

**Cómo verificar:** Before editing, run `git status --short --branch` and confirm
the current branch is `main`. Do not run `git switch`, `git checkout -b`, or
`git branch` creation commands unless the user requested a branch.

## 2026-05-23 - Money model canonical storage

**Estado:** Superseded by `2026-05-24 - RPG state canonical components`.

**Cambio original:** Economy spendable balances were documented as
`UserCurrency.balances`, bank balances as `UserCurrency.bankBalances`, and
economy status/activity/streak metadata as the `EconomyAccount` component. At
the time, legacy user-doc money fields remained schema-visible because RPG still
used embedded user money.

**Decisión actual:** `UserCurrency` owns all spendable and bank balances,
including RPG coin fees. Legacy `UserSchema.currency`, `UserSchema.bank`, and
embedded `UserSchema.economyAccount` are no longer schema-visible runtime model
fields.

**Motivo:** The follow-up RPG state reset moved hideout and processing fees onto
`UserCurrency`, removing the last runtime reason to keep embedded user money
bags in the schema.

**Cómo verificar:** Use the newer 2026-05-24 verification set for RPG state:
`bun test src/db src/features/rpg src/features/economy`, `bun run typecheck`,
targeted Biome, `git diff --check`, and `bun run start`.

## 2026-05-22 - Framework cleanup: dead router method + storage barrel boundary

**Cambio:** Se eliminó `ComponentRouter.dispatch()` (método muerto; `bootstrap.ts` usa
`router.resolve()` directamente y no había call-sites). Se corrigió `docs/storage.md` para importar
los adapters desde `@/framework/storage` en lugar del barrel `@/framework`.

**Motivo:** `dispatch()` era una segunda forma, no usada, de hacer lo que ya hace `resolve()`. El
doc prometía un import (`@/framework`) que el barrel `src/framework/index.ts` no exporta — drift
doc/código.

**Alternativas:** Exponer los adapters en el barrel `@/framework` para cumplir el doc fue rechazado:
anunciaría una segunda ruta de persistencia junto a `World`, en contra de la política latest-only y
del criterio de mantener mínima la superficie pública (`docs/codebase-audit.md`).

**Riesgos:** Bajo. Borrar código muerto no cambia comportamiento; el cambio de doc no toca runtime.

**Cómo verificar:** `bun test src/framework`, `bun run typecheck`, `bun run check`. Confirmar
`rg "\.dispatch\(" src` sin resultados.

## 2026-05-19 - Market vertical slice boundaries

**Cambio:** `src/features/economy/market.ts` now keeps the command-facing orchestration API, while market result/config/error types, pure listing transitions, and the legacy listing-store adapter live in focused modules.

**Motivo:** Market mixes money movement, inventory escrow, listing CAS, cooldowns, and legacy repository access. Splitting pure decisions from persistence makes the rollback path readable without changing command behavior.

**Alternativas:** A full move into `src/core/economy/market/*` was rejected for this iteration because `market.ts` is still the public import path for commands and tests. Keeping wrappers avoids import churn while the repo is already dirty.

**Riesgos:** The adapter still depends on the legacy `MongoStore` repository, so the persistence boundary is clearer but not fully migrated. Rollback remains best-effort when multiple downstream writes fail.

**Cómo verificar:** Run `bun test src/features/economy/market.test.ts`, `bun test src/features/economy`, `bun run typecheck`, and `biome check` on the touched market files.

## 2026-05-19 - Counting runtime wiring

**Cambio:** `counting` moved from a manual `register(client)` listener under `handlers/messageCreate.ts` to the current feature-loader contract: a top-level `handlers.ts` class with `@Listen("messageCreate")`.

**Motivo:** The active loader only discovers `<feature>/handlers.ts`; the old nested register function was not reachable at runtime. The domain state machine stayed in `processCountingMessage`.

**Alternativas:** Reintroducing a manual registration hook or widening the loader to scan nested handler files was rejected. Both would make the runtime contract less obvious.

**Riesgos:** Raw Discord listeners bypass command feature middleware, so counting still performs its own feature-toggle and configured-channel checks inside the handler.

**Cómo verificar:** Run `bun test src/features/counting`, `bun test src/framework`, and `bun run typecheck`.

## 2026-05-19 - Feature config catalog metadata

**Cambio:** Feature descriptors remain loader-only, while dashboard-editable feature config is attached through the explicit `FEATURE_CONFIGS` registry consumed by `setFeatureCatalog`.

**Motivo:** `listConfigurableFeatures()` needs config metadata for admin/webapp surfaces, but putting config on `defineFeature` would pollute the runtime descriptor and violate the current authoring rules.

**Alternativas:** Dynamic config discovery and descriptor-level config fields were rejected. The first adds loader behavior for one known need; the second weakens the descriptor boundary.

**Riesgos:** The registry must be updated when a new feature adds dashboard config. That explicit step is acceptable because config metadata is rare and admin-facing.

**Cómo verificar:** Run `bun test src/core/featureConfig.test.ts src/core/featureCatalog.test.ts src/features/adminPanels`, `bun test src/framework`, and `bun run typecheck`.

## 2026-05-19 - Legacy event bus boundary

**Cambio:** `src/core/bus.ts` is documented as a legacy dashboard/SSE bridge, not the general feature runtime bus.

**Motivo:** The current runtime already has `framework/event-bus` via `ctx.emit(...)` and `@On(EventClass)`. The string-keyed core bus remains only for live moderation/appeal projections consumed by the embedded webapp.

**Alternativas:** Migrating every core bus event now was rejected because it would pull moderation and webapp behavior into the stabilization slice.

**Riesgos:** Existing events still use a legacy path. The boundary is now explicit so new runtime events do not grow that surface by accident.

**Cómo verificar:** Run `bun test src/webapp/bot-bridge.test.ts`, `bun test src/framework`, and `bun run typecheck`.
