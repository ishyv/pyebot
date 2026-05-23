# Plan 08 — Split the 1017-line webapp bridge by feature

## Goal

Break `bot-bridge.ts` into per-feature modules so a dashboard change for one feature stops forcing
edits to a shared monolith — composed by a thin index, not a generic framework.

## Context / Why

`src/webapp/bot-bridge.ts` is 1017 lines and mixes moderation actions, automod, banned-image CRUD,
embed CRUD, and feature toggles. The active uncommitted work touches moderation, automod, and embeds
in this one file simultaneously — a sign the boundary is wrong. `bridge-types.ts` already holds the
shared contract, so the split has a natural seam.

**Constraint (`docs/codebase-audit.md:8-10`):** keep the composition simple; do not introduce a
generic plugin/registry abstraction. A plain index module that imports and re-exports per-feature
functions is enough.

## Files touched

- New `src/webapp/bot-bridge/<feature>.ts` — `moderation.ts`, `automod.ts`, `embeds.ts`,
  `banned-images.ts`, `features.ts` (toggles).
- `src/webapp/bot-bridge.ts` → becomes a thin index that re-exports from the per-feature modules,
  preserving the current public API so `bridge.ts` and the dashboard are unaffected.
- `src/webapp/bridge-types.ts` — unchanged (shared contract).
- `src/webapp/bot-bridge.test.ts` — keep green; add per-module coverage as modules appear.

## Tasks

1. Identify the function clusters in `bot-bridge.ts` (moderation actions, automod, banned-image CRUD,
   embed CRUD, feature toggles) and the types each uses from `bridge-types.ts`.
2. Move one cluster at a time into its module; re-export from `bot-bridge.ts` so imports don't churn.
3. Keep shared helpers (Discord.js ↔ webapp translation) in a small `bot-bridge/shared.ts` only if
   genuinely reused; otherwise leave them with their feature.
4. After all clusters move, decide whether `bot-bridge.ts` stays as the re-export index (recommended,
   minimal churn) or callers import per-feature directly.

## Risks

- **Medium.** The bridge has live, uncommitted changes — coordinate timing so this split doesn't
  collide with that work (do it after that work lands). Behaviour must not change; the re-export
  index keeps the public surface stable.

## Verification

```bash
bun test src/webapp
bun run typecheck
bun run check
```
- Exercise one dashboard action per moved cluster (e.g. a moderation action and an embed save) to
  confirm the bot still receives and processes them.
