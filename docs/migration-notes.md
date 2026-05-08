# Framework Migration Notes

This refactor is intentionally compatibility-first.

## Current Bridge

- `src/framework/**` is the new public framework surface.
- `src/core/bootstrap.ts` now starts the bundled bot through `createBot`.
- Existing `FeatureModule` objects still compile into the same runtime registry as decorated feature classes.
- New code should use decorators; old modules can be migrated feature by feature.

## Migration Order

1. Keep the baseline commit intact as the rollback point.
2. Migrate features with small surface area first: tickets, offers, counting.
3. Migrate high-risk shared surfaces after tests are expanded: admin panels, moderation, automod.
4. Migrate economy/RPG after storage and content boundaries are stable.

## Feature Checklist

For each feature migration:

- Declare `@Feature({ id, gate, intents, config })`.
- Move commands to `@SlashCommand` methods.
- Move buttons/selects/modals to typed component decorators with explicit prefixes.
- Move client events to `@Event` and declare required intents.
- Replace unmanaged intervals with `@Job`.
- Keep feature-owned config beside the feature.
- Add tests for command metadata, component parsing, and any storage behavior touched.

## Known Deferred Work

- Existing feature files are not all converted to classes yet.
- Repository code still uses Mongo directly.
- The admin panel runtime still has too much policy in large files.
- Some baseline tests fail typecheck because fixtures lag behind current schema types.
