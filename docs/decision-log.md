# Decision Log

## 2026-05-19 - Market vertical slice boundaries

**Cambio:** `src/features/economy/market.ts` now keeps the command-facing orchestration API, while market result/config/error types, pure listing transitions, and the legacy listing-store adapter live in focused modules.

**Motivo:** Market mixes money movement, inventory escrow, listing CAS, cooldowns, and legacy repository access. Splitting pure decisions from persistence makes the rollback path readable without changing command behavior.

**Alternativas:** A full move into `src/core/economy/market/*` was rejected for this iteration because `market.ts` is still the public import path for commands and tests. Keeping wrappers avoids import churn while the repo is already dirty.

**Riesgos:** The adapter still depends on the legacy `MongoStore` repository, so the persistence boundary is clearer but not fully migrated. Rollback remains best-effort when multiple downstream writes fail.

**Cómo verificar:** Run `bun test src/features/economy/market.test.ts`, `bun test src/features/economy`, `bun run typecheck`, and `biome check` on the touched market files.
