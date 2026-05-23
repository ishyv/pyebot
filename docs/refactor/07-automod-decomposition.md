# Plan 07 — Decompose the 1180-line automod command

## Goal

Shrink `automod.ts` to a thin command + a subcommand table, moving each handler into its own
focused module — an in-feature split, not a new framework.

## Context / Why

`src/features/automod/commands/automod.ts` is 1180 lines:

- A 17-branch `if/else if` subcommand dispatch (`:385-404`).
- 17 handler functions, each (a) hand-builds a `paths` record and calls `updateGuildPaths` directly
  (`:416-426`), and (b) re-builds its own success/failure V2 message (`:428-455`).

This mixes the command schema, routing, persistence, and UI in one file. The project's own guidance
(`docs/codebase-audit.md:8-10`) is to split repeated parser/mutation decisions **inside the affected
feature** rather than build a generic panel framework — exactly this shape.

## Dependencies

- Best done **after** `06-response-helpers.md` (use the new success/failure builders) and ideally
  alongside routing config writes through `configMutations` (see task 3).

## Files touched

- `src/features/automod/commands/automod.ts` — keep the `SlashCommandBuilder` definition + a
  subcommand→handler lookup; target < 300 lines.
- New `src/features/automod/commands/subcommands/*.ts` — one handler per file (linkspam, whitelist,
  report-channel, status, crosschannel, mentionspam, slowmode, raid, pattern, policy, image-*).
- `src/features/adminPanels/configMutations.ts` — reuse/extend `saveAutomodSettings` (`:92`).

## Tasks

1. Replace the `if/else if` chain (`:385-404`) with a `Record<string, Handler>` table; dispatch via
   `table[sub]?.(interaction, ctx)`.
2. Move each handler to `subcommands/<name>.ts`, exporting a single function with the existing
   signature `(interaction, ctx)`.
3. Route config writes through `configMutations.saveAutomodSettings` instead of building `paths`
   inline (kills the duplication and the schema-path drift risk; see master audit Finding 9).
4. Use the response helpers from plan 06 for the success/failure messages.

## Risks

- **Medium.** Many handlers move at once. Mitigations: the existing `automod.test.ts` +
  `configMutations.test.ts` + `automodPanel.test.ts` cover behaviour; move one subcommand at a time
  and keep tests green between moves. Preserve each subcommand's option parsing exactly.

## Verification

```bash
bun test src/features/automod src/features/adminPanels
bun run typecheck
bun run check
```
- Manually run two representative subcommands (one toggle like `linkspam`, one list like
  `image-list`) end-to-end and confirm identical replies and persisted config.
