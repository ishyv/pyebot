# Decision Log

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
