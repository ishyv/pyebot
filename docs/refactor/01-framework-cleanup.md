# Plan 01 — Framework cleanup: dead method + storage doc/code drift

## Goal

Remove one genuinely dead method and reconcile the documented-but-unwired storage adapters, with
zero behaviour change to the running bot.

## Context / Why

- `ComponentRouter.dispatch()` (`src/framework/router.ts:73-88`) is never called. The dispatcher in
  `bootstrap.ts:194,201` uses `router.resolve()` directly; `.dispatch(` has zero call-sites in
  `src/`. It is a second, trap-shaped way to do what `resolve()` already does.
- `docs/storage.md` presents `MemoryStorageAdapter`/`FileStorageAdapter` as an intentional
  framework surface imported via `import { ... } from "@/framework"`. But `src/framework/index.ts:9-26`
  does **not** export them, and nothing in `src/` imports `framework/storage` except
  `storage.test.ts:5`. So the public API the doc promises does not exist — doc/code drift.
  Per `docs/codebase-audit.md:13-14` the adapters are kept deliberately, so the correct move is to
  reconcile, **not** delete.

## Files touched

- `src/framework/router.ts` — remove `dispatch()`.
- One of (decision in plan 00, open question 3):
  - `src/framework/index.ts` — add `export { MemoryStorageAdapter, FileStorageAdapter } from "./storage";` (+ types), **or**
  - `docs/storage.md` — correct the import path to `@/framework/storage` and note it is not part of the public barrel.

## Tasks

1. Delete `ComponentRouter.dispatch()` (`router.ts:73-88`) and its now-unused imports
   (`ButtonInteraction`, select-menu types, `ModalSubmitInteraction`, `Ctx`) if no longer
   referenced in the file.
2. Confirm `router.test.ts` does not exercise `dispatch()`; if it does, drop that test (it covers a
   dead path).
3. Resolve the storage drift per the chosen option:
   - **Wire** option: export the adapters from the barrel; keep `storage.test.ts` as the contract test.
   - **Re-doc** option: fix `docs/storage.md` import path; leave code as-is.
4. Add a one-line entry to `docs/decision-log.md` recording the storage reconciliation choice.

## Risks

- **Low.** Removing dead code can't change behaviour. The only risk is the storage decision: wiring
  into the barrel widens the public surface (intended per the doc); re-docing keeps the surface
  minimal. Either is reversible.

## Verification

```bash
bun test src/framework
bun run typecheck
bun run check
```
- Grep to confirm no remaining references: `rg "\.dispatch\(" src` → none.
- If wiring storage: a smoke import test `import { MemoryStorageAdapter } from "@/framework"` compiles.
