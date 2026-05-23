# Plan 09 — Robustness hardening (small, independent fixes)

## Goal

Close a handful of low-surface robustness gaps. Each item is independent; do them à la carte.

## Context / Why & Items

### 9a. Bound `SessionManager`
`src/core/state.ts:40-58` is explicitly documented as having no TTL or size limit; the global
`sessions = new SessionManager<unknown>()` (`:103`) relies on every caller deleting its entries.
Any missed `delete` leaks memory for the process lifetime.
- **Do:** add an optional TTL and/or max-size (LRU-style eviction) to `SessionManager`, defaulting to
  a generous TTL so existing callers are unaffected. Keep the API additive.
- **Files:** `src/core/state.ts`, `src/core/state.test.ts`.

### 9b. Orphan cleanup for per-user collections
Deleting a user leaves rows in `questProgress`, `achievementUnlocks`, `marketListings`
(foreign-keyed by userId/guildId) — no cleanup path exists.
- **Do:** either a Mongo TTL index where a natural expiry exists (e.g. `expiresAt` on quests/market
  listings already present), or a cleanup helper invoked on user deletion. Prefer TTL indexes where
  the field already exists (zero runtime code).
- **Files:** repository init in `src/db/repositories/*`, plus the user-deletion path if added.

### 9c. Declarative admin gate in dispatch
Admin checks are per-command today (`assertPanelPermission`, `moderation/authorization.ts`); only
`isFeatureEnabled` is centralized in `bootstrap.ts:163`. A new admin command can forget the check.
- **Do:** add an optional `requiresAdmin?: boolean` (or `requiredPermissions`) to `defineCommand`,
  checked in `handleChatInputCommand` (`bootstrap.ts:152-174`) using the existing `isAdmin`
  (`middleware.ts:62`). Existing per-command checks can stay until migrated.
- **Files:** `src/framework/command.ts` (type), `src/framework/bootstrap.ts`, `src/framework/types.ts`.

### 9d. (Optional) Validated env at boot
`process.env.*` is read ad hoc in `index.ts`, `core/db.ts`, `ai/service.ts`, `webapp/server.ts`.
A single Zod-parsed `env` object at startup would fail fast on misconfiguration instead of producing
confusing runtime errors. Low priority at current scale — include only if it pays for itself.
- **Files:** new `src/core/env.ts`; callers read from it.

### 9e. (Trivial) Replace deprecated `ephemeral: true`
`bootstrap.ts:155,166` use the deprecated `ephemeral: true` form; newer discord.js prefers
`flags: MessageFlags.Ephemeral`. Cosmetic; bundle into another framework PR.

## Risks

- **9a/9c:** Low — additive APIs. **9b:** Medium — deletion/TTL touches persisted data; verify on a
  dev DB and confirm TTL fields are correct before enabling an index in prod. **9d:** Low but
  broad-touch. **9e:** Trivial.

## Verification

```bash
bun test src/core src/framework src/db
bun run typecheck
bun run check
```
- 9a: test that an entry expires/evicts. 9c: test that a `requiresAdmin` command rejects a
  non-admin and allows an admin. 9b: verify orphaned rows are gone after the cleanup/TTL on a dev DB.
