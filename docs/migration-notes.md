# Latest-Only Notes

tx does not keep runtime compatibility with previous framework versions. Use
git checkpoints for rollback; do not add compatibility branches to startup,
content loading, env parsing, or schema parsing.

Current boundaries:

- Features are `src/features/<id>/` folders discovered by `bootstrapFramework`.
- Feature descriptors use `defineFeature`; commands use `defineCommand`.
- Feature toggles live in `guild_features.overrides`; old embedded
  guild-document feature data is unsupported and ignored.
- Active RPG runtime content lives in `src/features/rpg/content/**`.
- `src/content/packs/default.ts` is seed/extended catalog data only.
- `DISCORD_TOKEN` is the only Discord token env key.
- MongoDB reads use the current driver result shape.
- Existing persisted data from older shapes should be reset or migrated outside
  runtime before starting this version.

When removing an old path, delete the code, update the tests, and update the
docs in the same change. Half-removed compatibility is just bloat with a hat.
