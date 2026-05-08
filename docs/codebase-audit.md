# Codebase Audit

This audit tracks current refactor pressure after the latest-only cleanup.

## Current Hot Spots

- `src/features/adminPanels/panels.ts` still mixes rendering, action dispatch,
  modal parsing, and persistence patch construction. Split by responsibility
  before adding more panels.
- Economy and RPG flows still have large service surfaces. Keep content data in
  `src/content/packs/default.ts` and keep feature code focused on behavior.
- Framework-facing storage should use storage adapter contracts. Raw Mongo is
  still acceptable inside bundled feature repositories that need Mongo-specific
  operations.
- Guild schema defaults are product behavior. Missing current fields can be
  defaulted for new documents; malformed old top-level config slices should
  fail instead of being normalized.

## Cleanup Policy

tx is latest-only. Do not add runtime bridges for old feature objects, old env
aliases, old JSON content packs, old driver result wrappers, or old persisted
document shapes.
