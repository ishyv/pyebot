# Plan 06 — Small response + DB-error helpers (low abstraction)

## Goal

Cut the most-copied UI/error boilerplate with a few tiny, obvious helpers — and standardize on
`ctx.respond` — without building a generic response framework.

## Context / Why

Two idioms coexist and one template is copy-pasted everywhere:

- Newer commands use `ctx.respond.defer/send/fail`; older economy/moderation/rpg commands use raw
  `interaction.deferReply/editReply` (e.g. `economy/commands/balance.ts:14-36`,
  `rpg/commands/fight.ts:20-60`). 534 reply call-sites across 71 files.
- The V2 shape `v2Message(container("ok"|"danger", text("## …"), [separator(), text(…)]))` is
  rebuilt with only accent + text varying (`automod.ts:443-455`, `balance.ts:26-36`,
  `fight.ts:51-59`).
- The DB-error string `"Failed to load guild config"` / `"Could not update …"` is re-typed 15+
  times (`automod.ts:430,470,572,…`).

**Constraint (`docs/codebase-audit.md:8-10`):** prefer small, local helpers over a generic
framework. Keep these thin.

## Files touched

- `src/ui/v2.ts` (or a sibling `src/ui/messages.ts`) — add `successMessage`, `failureMessage`,
  `configUpdateMessage` builders on top of the existing `v2Message`/`container`/`text`/`separator`.
- A small `handleDbError(result)` helper near `ctx.respond` / `interactionResponder.ts`.
- Migrate raw-`editReply` commands to `ctx.respond` incrementally (one feature per PR).

## Tasks

1. Add the builders (each ~5 lines) wrapping the existing primitives — accent + text in, V2 message
   out. No new types beyond what `v2.ts` already exports.
2. Add `handleDbError(result, ctx)` that logs and replies a standard failure message; use it where
   the duplicated error strings live.
3. Replace the copy-pasted templates with the builders (start with automod since it has the most).
4. Migrate raw `deferReply/editReply` commands to `ctx.respond`, one feature module per PR. Do not
   change behaviour (ephemeral vs public must match the original).

## Risks

- **Low–Medium.** Mostly mechanical. Risk is changing visibility (ephemeral/public) or message
  content during migration — diff each migrated reply against the original. Don't over-extract:
  if a message is genuinely one-off, leave it inline.

## Verification

```bash
bun test src/features/automod src/features/economy src/ui
bun run typecheck
bun run check
```
- Manually exercise one migrated command end-to-end (per `CLAUDE.md` run commands) to confirm the
  reply looks identical and respects ephemeral/public.
