# Codebase Context Debt Audit

## Executive Summary

This audit covers bot source files under `src/**/*.ts`, excluding tests. It
treats `src/content/packs/default.ts` as authored RPG content data instead of
code bloat, except where content-system architecture leaks into surrounding
code.

The codebase is not uniformly undocumented. Some core modules already explain
the design well, especially `src/core/feature.ts`, `src/core/registry.ts`,
`src/content/registry.ts`, and several middleware/economy modules. The real
problem is concentrated: a few files carry a lot of policy, persistence shape,
UI flow, and migration baggage with little or no rationale. Those are the
places where new work is most likely to become archaeology.

Top context-debt areas:

- `src/features/adminPanels/panels.ts` is the largest source hotspot: 1,294 LOC,
  0 comment lines, and several responsibilities packed into one file.
- `src/features/adminPanels/*` has 1,765 non-test source lines and 0 comment
  lines, despite being the admin surface that writes many guild config paths.
- `src/core/featureConfig.ts` exposes the feature-owned config metadata system
  but does not explain why it exists separately from `GuildSchema`.
- `src/content/schemas.ts` defines the runtime content contract but barely
  explains the boundary between Zod validation, typed authoring helpers, and
  legacy JSON5 packs.
- `src/db/schemas/guild.ts` has the most important defaulting and recovery
  policy in the bot, but the repeated `.catch()` strategy is not documented.

## Audit Method

Metrics were gathered with a read-only PowerShell scan over non-test
`src/**/*.ts` files. The scan counted physical lines, comment-looking lines,
type/interface/enum declarations, and exported declarations. The large typed
content pack was excluded from hotspot ranking because it is data.

Current source baseline, excluding tests and `src/content/packs/default.ts`:

- 168 files
- 20,440 lines
- 1,668 comment lines

This is a heuristic audit, not a style verdict. Comment count alone is a dumb
metric if used blindly; adorable little trap, that one. The ranking also weighs
responsibility mixing, hidden policy, export/type density, legacy markers, and
whether existing docs explain behavior that the source itself does not preserve.

## Ranked Findings

| Priority | Path | Evidence | Missing context | Risk | Recommended next action |
| --- | --- | --- | --- | --- | --- |
| P0 | `src/features/adminPanels/panels.ts` | 1,294 LOC, 0 comment lines. Contains panel rendering, action dispatch, modal creation, modal parsing, guild config writes, role records, automod config writes, feature config writes, and DB reads. | No module map, no ownership boundaries, no explanation of which paths are canonical, which writes are compatibility mirrors, or why UI state and persistence writes live together. | High chance of accidental config corruption or inconsistent admin behavior when changing a panel. Reviewers must simulate the entire file mentally. | Refactor into grouped modules before adding new admin panels: declarative panel metadata, renderers, action handlers, modal parsers, and patch builders. Add a short module-level rationale first so the split has a target shape. |
| P0 | `src/features/adminPanels/panelRuntime.ts` | 255 LOC, 0 comment lines, 15 exports. Owns session TTL, custom ID encoding, nav rows, ephemeral command replies, and component message update semantics. | Why sessions are in-memory, why TTL is 5 minutes, what guarantees custom IDs need, and how modal submits differ from component updates. | The runtime is shared by every admin panel. A small change can break all admin interactions or leak stale controls. | Add module-level docs for lifecycle and Discord interaction constraints. Keep comments focused on protocol decisions, not obvious builder calls. |
| P1 | `src/core/featureConfig.ts` | 220 LOC, 0 comment lines, 13 type/interface/enum-ish definitions, 18 exports. | Why feature-owned config metadata exists separately from `GuildSchema`, how path-based patches are allowed to target nested guild fields, and why channel resolution returns `null` instead of throwing. | Future features may bypass the metadata system, duplicate dashboard code, or store state in config because the boundary is implicit. | Add an architectural header and JSDoc on `defineFeatureConfig`, `buildConfigFieldPatch`, and `resolveConfiguredChannel`. Do not refactor first; this needs rationale more than surgery. |
| P1 | `src/db/schemas/guild.ts` | 368 LOC with many Zod defaults and `.catch()` recovery branches. Existing test mentions legacy panel config normalization. | The schema recovery policy is not stated: which corrupt/missing fields should be healed silently, what defaults are product decisions, and which fields are legacy compatibility. | Defaults become accidental behavior. Bad persisted data can be hidden, and cleanup migrations become harder because nobody knows what is intentional. | Add a schema policy header. Extract default objects/functions for repeated values only after documenting the current behavior. |
| P1 | `src/content/schemas.ts` | 264 LOC, 1 comment line, 17 type-ish declarations, 44 exports. | The file does not describe the boundary between runtime Zod schemas, inferred public types, typed pack helpers, and legacy pack validation. It also does not explain ID permanence. | Content authors and feature authors can confuse schema validation with authoring policy, leading to duplicated checks or unstable persisted IDs. | Add module-level docs linking runtime schemas to `src/content/authoring.ts` and `docs/content-authoring.md`. Add short comments only for non-obvious invariants such as ID stability, processing recipe uniqueness, and market bounds. |
| P2 | `src/content/validation.ts` and `src/content/authoring.ts` | Validation is 186 LOC with 2 comment lines; authoring is type-heavy and intentionally compile-time. Existing docs explain the authoring flow better than the source. | Why some constraints are compile-time and others runtime; why JSON5 legacy packs still exist. | Future checks may be added to the wrong layer, either weakening runtime validation or making authoring types too clever. | Add a small "layering" note to each module. Avoid expanding type gymnastics until the runtime/compile-time split is documented. |
| P2 | `src/features/counting/expression.ts` | 153 LOC, 0 comment lines. Hand-rolled arithmetic parser with length limit, safe integer check, division-by-zero handling, whitespace support, and recursive precedence parsing. | Why expressions are accepted at all, why length is 80, what grammar is intentionally supported, and why only safe integers pass. | Parser changes can accidentally allow unsafe or surprising input in a public message handler. | Add a concise grammar/risk comment and tests for any future grammar change. No immediate refactor needed; the code is compact. |
| P2 | `src/features/counting/service.ts` | 120 LOC, 1 comment line. Includes a keyed async queue, reset policy, expression evaluation, state persistence, and reaction fallback. | Why per-channel serialization is needed, why same-user repeats reset, why failed reactions are non-fatal, and why reset goes to expected value `0`. | Race conditions in active counting channels if queue behavior is changed without understanding the Discord event ordering problem. | Add a module-level game invariant note and JSDoc for `KeyedAsyncQueue` or replace it later with a shared utility if another feature needs keyed serialization. |
| P2 | `src/features/rpg/crafting/*` | `recipes.ts` and `item-registry.ts` clearly say they are legacy shims. `alchemy.ts` and `crafting-engine.ts` still contain active logic, AI fallback, inventory writes, and a TODO that deterministic crafting does not consume inventory. | The directory mixes compatibility shims with live crafting behavior. Docs warn not to author content here, but the source does not mark which files are safe to delete later. | Engineers may delete a "legacy" file that still participates in active crafting, or keep dead shims forever because ownership is fuzzy. | Create a shim inventory: keep `alchemy.ts` and `crafting-engine.ts` as active runtime, quarantine `recipes.ts` and `item-registry.ts` behind compatibility exports, and open a removal ticket for callers that still import the shims. |
| P3 | `src/features/economy/market.ts` | TODOs state inventory deduction/return is not implemented for seller, buyer, and cancellation flows. | The market contract around currency-only vs inventory-backed listings is incomplete. | Users may treat listings as real inventory transfers while code currently handles balance/listing state only. | Track as product debt, not comment debt. Before refactor, decide whether market inventory integration is in scope. |
| P3 | `src/features/ai/service.ts` | Inline note says a fuller refactor would pass `CoreMessages` to Vercel `generateText`. | The AI abstraction's intended provider boundary is unclear. | Provider changes may keep adding adapter-specific special cases. | Add to later architecture review. Not a top cleanup target unless AI behavior is changing. |

## Bloat-Removal Backlog

### Admin Panels

1. Add a short design header to `panelRuntime.ts` covering session ownership,
   TTL, custom ID shape, and ephemeral interaction rules.
2. Add a short design header to `panels.ts` before splitting it, naming the
   current responsibilities and the intended module boundaries.
3. Extract declarative panel constants and field definitions from `panels.ts`
   into a metadata module.
4. Extract panel renderers into modules grouped by domain: channels/features,
   moderation/automod/roles, and feature-specific panels.
5. Extract write paths into patch-builder helpers so UI handlers stop manually
   constructing Mongo dot paths inline.
6. Add focused tests for patch builders and modal parsing before moving the
   highest-risk write paths.

### Guild Config And Feature Config

1. Document the policy split:
   - `GuildSchema` defines persisted shape and recovery defaults.
   - `FeatureConfigDefinition` defines dashboard-editable fields owned by a
     feature.
   - Runtime feature state belongs in repositories or feature-owned collections,
     not the guild document.
2. Add JSDoc to `defineFeatureConfig`, `buildConfigFieldPatch`, and
   `resolveConfiguredChannel`.
3. Extract repeated guild defaults only after the policy is documented; otherwise
   a tidy refactor will just hide the same unexplained choices in smaller boxes.
4. Add tests for any new config field kind before allowing more admin panel
   controls.

### Content System

1. Add a source-level layer map:
   - `schemas.ts`: runtime shape and inferred public types.
   - `authoring.ts`: compile-time authoring constraints for built-in typed packs.
   - `validation.ts`: cross-record checks and legacy pack diagnostics.
   - `registry.ts`: immutable runtime indexes.
2. Keep `src/content/packs/default.ts` classified as data. Split it only for
   authoring ergonomics, not because LOC metrics are yelling.
3. Document ID permanence near `CONTENT_ID_REGEX`, because IDs are persisted in
   inventory and recipes.

### Counting

1. Document the accepted arithmetic grammar and safety limits in
   `expression.ts`.
2. Document the game invariants in `service.ts`: one channel queue, no same-user
   consecutive counts, reset behavior, and non-fatal reactions.
3. Keep parser refactors out of the first cleanup pass unless tests are expanded
   first.

### RPG Crafting Compatibility

1. Inventory imports of `src/features/rpg/crafting/recipes.ts` and
   `item-registry.ts`.
2. Replace shim imports with content registry access where practical.
3. Mark active files separately from compatibility files:
   - Active runtime: `alchemy.ts`, `crafting-engine.ts`.
   - Compatibility: `recipes.ts`, `item-registry.ts`.
4. Resolve the deterministic crafting inventory TODO before removing old
   crafting pathways.

## Document vs Refactor Guidance

| Area | First move | Why |
| --- | --- | --- |
| `adminPanels/panels.ts` | Refactor with tests after adding a short orientation header. | The file is too mixed for comments alone. Documentation should guide the split, not decorate the pile. |
| `adminPanels/panelRuntime.ts` | Document first. | Shared Discord interaction constraints are the important missing context. The module is not huge enough to demand immediate extraction. |
| `core/featureConfig.ts` | Document first. | The API shape is reasonable; the missing piece is architectural rationale and path-write policy. |
| `db/schemas/guild.ts` | Document, then extract defaults. | Behavior is sensitive because defaults heal persisted data. Refactor before policy would be risky. |
| `content/schemas.ts` | Document first. | The file is mostly declarations. The confusion is boundary/rationale, not raw structure. |
| `content/validation.ts` / `content/authoring.ts` | Document layering. | The compile-time/runtime split is subtle and should be explicit before more checks are added. |
| `counting/expression.ts` | Document grammar and safety limits. | The parser is compact; context is missing, not necessarily structure. |
| `counting/service.ts` | Document invariants; consider shared queue only if reused. | The queue exists for race prevention, and that reason should be obvious at the call site. |
| `rpg/crafting/*` | Inventory and quarantine shims. | The directory mixes old compatibility with active AI crafting, so deletion requires import evidence. |

## Notes For The Next Cleanup Pass

- Keep the first implementation pass small: admin panel docs plus feature/guild
  config rationale gives the best clarity-per-line.
- Do not enforce blanket JSDoc. This codebase needs "why this shape exists"
  comments around policy and boundaries, not descriptions of every property.
- Do not let LOC metrics target content data. `default.ts` is huge, but the
  authoring docs already establish it as the canonical built-in pack.
- Treat current git status as dirty and noisy. Avoid formatting or mass file
  movement until the delete/re-add state is understood.
