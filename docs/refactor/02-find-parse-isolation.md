# Plan 02 — Isolate per-document parse failures in `MongoStore.find()`

## Goal

Stop a single malformed document from failing an entire batch query, **without** weakening the
deliberate strict-fail behaviour for single-document config reads.

## Context / Why

`MongoStore.find()` (`src/db/store.ts:184-192`) does `docs.map((doc) => this.parse(doc))`, and
`parse()` (`:54-63`) **throws** on the first invalid document. The surrounding `try/catch`
(`:189-190`) converts that throw into a whole-query `ErrResult`. Result: one corrupt row makes a
leaderboard, market browse, or any list view return *nothing* — dropping all valid rows.

**Important policy constraint.** `docs/codebase-audit.md:15-17` states malformed old top-level
config slices should *fail* rather than be normalized. That policy is about **single-document config
reads** (`get()` on a guild/user). It is reasonable to keep `get()` strict. The batch case is
different: silently losing every valid row because of one bad row is almost certainly not the
intended product behaviour. This plan changes **only** `find()`.

## Files touched

- `src/db/store.ts` — `find()` only.
- `src/db/store.test.ts` — add a batch-with-one-bad-doc test.

## Tasks

1. Change `find()` to parse each document independently: keep valid parsed docs, skip invalid ones,
   and `log.warn` (via the existing logger) each skip with collection name + `_id`. Do **not** throw.
   - Consider returning the valid subset directly (simplest, matches "list views should still
     render"). Avoid introducing a new partial-result type unless a caller needs the skipped count —
     YAGNI per project conventions.
2. Leave `get()`, `ensure()`, `patch()`, `replaceIfMatch()` strict (single-doc reads keep current
   fail behaviour, consistent with the config policy).
3. Replace the raw `console.error` in `parse()`/`getDefault()` (`:47, :58`) with the structured
   logger while here — only if trivial; otherwise out of scope.

## Risks

- **Low–Medium.** Callers currently get `Err` on a bad batch; they will now get a (possibly shorter)
  array. Any caller that relies on "all-or-nothing" semantics would change — grep `\.find(` usages
  to confirm none depend on failure-on-corruption (none expected; corruption is an edge case).
- A skipped row becomes invisible until fixed — acceptable, and the warn log surfaces it.

## Verification

```bash
bun test src/db/store.test.ts
bun test src/db
bun run typecheck
```
- New test: insert two valid docs + one that violates the schema; assert `find()` returns the two
  valid docs and logs one warning, rather than returning `Err`.
