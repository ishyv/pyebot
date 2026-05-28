# Codebase Audit

This audit tracks current refactor pressure after the latest-only cleanup.

## Current Hot Spots

- Admin panel pressure now lives mostly in large per-panel files such as
  automod, economy, roles, and new-users. Keep `panelDispatcher.ts` simple;
  split repeated parser/mutation decisions inside the affected panel instead
  of building a generic panel framework.
- Economy and RPG flows still have large service surfaces. The seed catalog
  `src/content/packs/default.ts` ships **items only**; gameplay content
  (locations, drop tables, recipes) lives in `src/features/rpg/content/**`. Keep
  feature code focused on behavior.
- Storage adapters are starter utilities for now. The bundled full bot uses
  Mongo-backed `World` components and feature repositories.
- Guild schema defaults are product behavior. Missing current fields can be
  defaulted for new documents; malformed old top-level config slices should
  fail instead of being normalized.

## Cleanup Policy

tx is latest-only. Do not add runtime bridges for old feature objects, old env
aliases, old JSON content packs, old driver result wrappers, or old persisted
document shapes.
