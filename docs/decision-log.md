# Decision Log

## 2026-05-23 - Money model canonical storage

**Cambio:** The money model is documented as distinct-by-design. Current economy spendable
balances live in `UserCurrency.balances`, current bank balances live in
`UserCurrency.bankBalances`, and current economy status/activity/streak metadata lives in the
`EconomyAccount` component. Legacy `UserSchema.currency`, `UserSchema.bank`, and embedded
`UserSchema.economyAccount` remain schema-visible user-doc fields, but they are not the current
economy source of truth.

**Motivo:** Economy services and commands read/write the component-backed `UserCurrency` and
`EconomyAccount` paths. Legacy RPG money still uses `user.currency.coins` in hideout/processing
flows, so migrating it would be behavior and data movement work, not documentation cleanup.

**Alternativas:** Consolidating or removing the legacy user-doc fields was rejected for this
slice. That requires a separate migration plan for RPG money and persisted user documents.

**Riesgos:** Runtime risk is low because this changes comments/docs only. The remaining product
risk is that legacy RPG money and current economy money stay separate until an explicit migration
decides whether to merge them.

**Cómo verificar:** `bun test src/features/economy`, `bun test src/db/schemas`, targeted Biome on
the touched docs/schema files, then `bun run typecheck` and `bun run check` for broader baseline
visibility.

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
