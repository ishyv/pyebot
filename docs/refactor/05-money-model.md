# Plan 05 — Clarify the user money model (decision-first)

## Goal

Resolve the undocumented overlap between the three money-related fields on the user document so
there is one obvious source of truth, then document or consolidate accordingly.

## Context / Why

`src/db/schemas/user.ts` carries three money concepts with no documented boundary:

- `currency` (`:61`) — `CurrencyInventorySchema`, a record of currency-id → balance.
- `bank` (`:63-66`) — optional `record<string, number>`.
- `economyAccount` (`:80-82`) — `EconomyAccountSchema` (status, streak, version, timestamps).

It is unclear which is canonical for "how much money does a user have," how `currency` vs `bank`
relate (wallet vs savings?), and what `economyAccount` owns. This ambiguity is a correctness risk
for any economy feature and blocks confident refactors.

## This plan is decision-first

Do **not** change schema before answering (open questions, also in `00-INDEX.md`):

1. Are `currency`, `bank`, and `economyAccount` intentionally distinct (e.g. wallet / bank /
   account-state), or accreted overlap to consolidate?
2. Which field is the canonical spendable balance?

Gather evidence to inform the decision:
```bash
rg "\.currency\b|currency\[" src/features/economy
rg "\.bank\b|bank\[" src/features/economy
rg "economyAccount" src/features src/db/repositories
```
Map who reads/writes each field and whether any code keeps two of them in sync.

## Files touched (after the decision)

- `src/db/schemas/user.ts`, `src/db/schemas/economy-account.ts`, `src/db/schemas/currency.ts`.
- `src/features/economy/*` read/write sites if consolidating.
- `docs/decision-log.md` — record the outcome regardless of which path is chosen.

## Tasks

- **If distinct-by-design:** add doc comments on each field in `user.ts` stating its role and the
  canonical balance source. No behaviour change. Lowest risk.
- **If overlap:** pick the canonical field, migrate readers/writers to it, and remove the redundant
  one. This touches money movement — do it on its own branch with the economy tests as the net.

## Risks

- **Medium–High** if consolidating (money movement, possible data migration). **Low** if the
  decision is "distinct, just document it."

## Verification

```bash
bun test src/features/economy      # economy.test, mutations.test, market.test, work.test, achievements.test
bun run typecheck
bun run check
```
- If consolidating: add a migration note and verify balances round-trip on a dev DB sample.
