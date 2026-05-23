# Plan 03 — Type the untyped bags on the user document

## Goal

Replace the `z.record(string, unknown)` "bags" on the user schema with concrete Zod schemas so the
data model describes its own shape — the single biggest "we don't actually know what the data is"
win. Highest reward of the set.

## Context / Why

`src/db/schemas/user.ts` carries four fields that defeat validation and type-safety:

- `inventory` (`:62`) — `z.record(z.string(), z.unknown())`
- `minigames` (`:87-90`) — `z.record(z.string(), z.unknown())`
- `votingStats` (`:91-94`) — `z.record(z.string(), z.unknown())`
- `voteAggregates` (`:95-98`) — `z.record(z.string(), z.unknown())`

Because these are `unknown`, every read site casts, bugs are silent, and refactors are scary. The
project is "latest-only" (`docs/codebase-audit.md:19-23`), so the new schemas should **fail** on
malformed legacy data rather than add compatibility shims — consistent with the existing parse
policy.

## Files touched

- `src/db/schemas/user.ts` — replace the four `unknown` records with concrete schemas (one per bag).
- Likely new small schema files (one per bag) if a shape is large, e.g.
  `src/db/schemas/minigames.ts`, mirroring how `rpg-profile.ts` / `economy-account.ts` are factored.
- Read sites that currently cast — remove now-unneeded casts.

## Tasks (one bag per PR — do not batch)

1. **Inventory the real shape of each bag.** For each field, find the writers:
   ```bash
   rg "inventory\b"      src/features src/db/repositories
   rg "minigames\b"      src/features src/db/repositories
   rg "votingStats\b"    src/features src/db/repositories
   rg "voteAggregates\b" src/features src/db/repositories
   ```
   Record the keys and value types actually written (and any read sites that assume a shape).
2. Define a concrete Zod schema from the observed shape. Follow the existing subdocument pattern
   (`rpg-profile.ts`, `economy-account.ts`): a named schema + `z.infer` type, embedded with
   `.catch()` defaults only where a *current* field may be missing — not to mask malformed data.
3. Swap the field in `UserSchema`; remove downstream casts; fix any type errors the new precision
   surfaces (these are latent bugs being exposed — good).
4. Repeat per bag. `inventory` first (most-used, pairs with the economy/RPG item model), then
   `minigames`, then the voting fields.

## Risks

- **Medium.** Tightening a schema can surface real data that doesn't match assumptions. Mitigate by
  driving the schema from actual writers (step 1), not from a guess, and by parsing a sample of
  real documents from a dev DB before merging (see verification).
- Voting fields may be partly produced by the legacy `core/bus.ts` path (`decision-log.md:39-49`) —
  check that writer too.

## Verification

```bash
bun test src/db src/features/economy src/features/rpg
bun run typecheck     # surfaces every read site the new types affect
bun run check
```
- Parse a sample of real user documents from a dev DB through the new schema; confirm **no**
  `.catch()` fallback is silently triggered (add a temporary throwing variant during the check).

## Related

- Money fields (`currency`/`bank`/`economyAccount`) are handled in `05-money-model.md` — keep that
  decision separate from the bag typing.
