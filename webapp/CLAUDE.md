# webapp — CLAUDE.md

Guidance specific to `webapp/` (SvelteKit dashboard, in-process with the bot). Inherits from the repo root [CLAUDE.md](../CLAUDE.md).

## Stack

SvelteKit 2 · Svelte 5 (runes) · Tailwind v4 (via `@tailwindcss/vite`) · `@hyvnt/hyvui` 0.4+ · MongoDB · `mongodb` driver. Embedded — bot imports `webapp/build/handler.js` at startup. No HTTP between bot and webapp; `getBridge()` is a synchronous accessor on `globalThis.__txBotBridge__`.

## HyvUI design law (binding)

These are non-negotiable. Any change that breaks them must be reverted, not "fixed in a follow-up."

- **No raw hex colors.** Use `var(--accent)` / `var(--text-soft)` etc., or Tailwind token classes (`text-accent`, `bg-bg-elev`, `border-line`). The only exception is the critical-CSS block in [src/app.html](src/app.html) — that must paint before any stylesheet evaluates.
- **No Tailwind built-in palette names.** `text-blue-500`, `bg-gray-900`, etc. are forbidden. Only token classes.
- **Lowercase for all UI strings.** Labels, buttons, headings, nav items, breadcrumbs. The `<title>` tag in `<svelte:head>` stays sentence case for browser-tab readability — that is the only exception.
- **No em-dashes in UI copy.** Use commas, periods, or `/`. (Code comments may use them.)
- **Font weight defaults to 400.** Hierarchy through size, tracking, and color, not weight. Only HyvUI's own components are allowed to use heavier weights internally.
- **No `border-radius` unless intentional.** Default is no rounding. Use `var(--radius-sm)` (2px) or `var(--radius-md)` (4px) when subtle rounding genuinely belongs.
- **Two accent hues at base: gold (`--accent`) and teal (`--signal`).** New colors only enter via theme registers (`hextech` adds cobalt/cyan/brass; `arcane` adds violet/magenta).
- **Error copy describes the condition, not the cause.** "signal interrupted" / "connection refused" / "session expired", never literal "Error" or "Warning" titles, never HTTP codes in user-facing strings.
- **Font-size floor for inline declarations.** Never below `0.78rem` for mono labels, never below `0.9rem` for body-equivalent text. The library itself drifts below this floor; we don't follow it down. Prefer letting HyvUI's `--reg-body-size` / `--reg-label-size` from [src/theme.css](src/theme.css) drive size; only set inline `font-size` when no token applies.
- **Prefer HyvUI patterns over hand-assembled primitives.** Before composing `Panel + Stack + Label + Button`, check `patterns/` — `PageHeader`, `ConfirmDialog`, `SearchBar`, `ActionBar`, `TerminalBoot` may already do it.
- **Prefer scenes for full-page layouts.** `StageScene` (hero/landing), `ReadoutScene` (dashboards/data), `ArchiveScene` (catalogs/galleries), `NarrativeScene` (story), `LogScene` (terminal output).

## Project override layer

[src/theme.css](src/theme.css) is the sanctioned override surface (per HyvUI's `system/override-template.css`). It tunes `--reg-body-size`, `--reg-label-size`, `--reg-spacing-scale`, `--reg-ornament-opacity`, `--reg-surface-opacity` for the dashboard's density/readability needs, and ships two project utilities:

- `.lift` — subtle hover translateY for interactive non-FloatCard rows/cards (features list, rpg items).
- `.float-slot` — z-index management wrapper for FloatCard grids so hover tilt sits over neighbors instead of pushing them.

Do not bypass theme.css to patch visual issues. If a knob doesn't exist on the `--reg-*` surface, the fix belongs upstream in HyvUI (see `C:\Users\Hyvnt\T\Svelte\hyvui\REVAMP-BRIEF.md`), not a local override.

## Registers

Two families, both selector-driven via `data-register=…`:

- **Weight registers** shift density and font emphasis without changing colors. Set globally by `AppShell register="…"` in [src/routes/+layout.svelte](src/routes/+layout.svelte). We use `mission-control` (dense, mono-forward) because the whole webapp is a dashboard.
- **Theme registers** remap colors. We use two: `hextech` (cobalt + cyan + brass, "instrumented/precise") and `arcane` (violet + magenta, "energy/economy"). Scope: a page declares its theme by returning `{ register: 'hextech' }` from `+page.server.ts`; [src/routes/+layout.svelte](src/routes/+layout.svelte) wraps the page in `<div data-register={register}>`. Server-rendered, so no first-paint flash.

Register-to-surface map (don't drift from this without discussion):

| theme | surfaces |
|---|---|
| (none / base) | login, guilds list, features, channels, roles |
| `hextech` | overview, moderation, automod |
| `arcane` | economy, rpg editor |

## Motion budget (strict)

Four idioms. Anything beyond this list needs explicit user sign-off:

1. **Route transition** — 180ms `fade` in [src/routes/+layout.svelte](src/routes/+layout.svelte). One idiom.
2. **Mount reveal** — `use:surface` on the main column and on `Panel`/`Card` lists with `{ delay: i * 60 }`.
3. **Primary click** — `use:echo` on the single primary submit per form. Not every button.
4. **Form result** — `use:resolve` on the `<form>`, triggered from `use:enhance`'s callback alongside `toastStore.push(…)`.

`FloatCard` (`tiltMax={3}`) is allowed only on the guilds-list cards. Wrap each in a `.float-slot` (from theme.css) so hover doesn't overlap neighbors.

No third-party motion library. No spring physics. No scroll-linked animation. HyvUI handles `prefers-reduced-motion` internally.

## Where to look in HyvUI

After `bun install`, the library lives at `node_modules/@hyvnt/hyvui/dist/`. Reference files:

- `examples/HextechForge.svelte` — canonical hextech composition. Use as the model for moderation/automod/overview.
- `examples/ArcaneShard.svelte` — canonical arcane composition. Use as the model for economy/rpg.
- `examples/FieldReport.svelte` — canonical base composition. Use as the model for guilds list / channels / roles.
- `tokens/{tokens,hextech,arcane}.css` — every CSS var available per register.
- `system/register.css` and `system/expressions.css` — selector source for registers and `Text` expressions.

Authoritative docs live in the HyvUI repo at <https://github.com/ishyv/hyvui>: `llms.txt` (terse reference), `AESTHETICS.md` (palette/typography), `SKILL.md` (anti-patterns + AI orientation), `INSTALL.md`, `COMPONENTS.md`.

## Data flow (do not rewrite)

- `getBridge()` from [src/lib/server/bridge.ts](src/lib/server/bridge.ts) is the only path to the bot. It returns `Result<T, Error>` — every page loader checks `isErr()` and surfaces the failure via `ErrorState`.
- Forms use SvelteKit form actions (`<form method="POST" action="?/save…">`) with `use:enhance`. Endpoints live in the per-route `+page.server.ts`. The redesign does not change endpoints — it only changes how their results are presented (toast + resolve).
- Access guards: `requireGuildAdmin()` (most pages), `requireRpgEditor()` (`/rpg`). Both fail-closed.

## Commands (run from `webapp/`)

```
bun install              # bring deps into node_modules
bun run check            # svelte-kit sync + svelte-check (strict TS, must be clean)
bun test                 # vitest, jsdom env
bun run build            # vite build → build/handler.js (consumed by the bot)
```

To run the full app: from repo root, `WEBAPP=true bun dev` boots the bot with the webapp on port 4000.

## Design-law audit (run before commit)

```
rg -n '#[0-9a-fA-F]{3,8}' src                                                # no raw hex outside app.html
rg -n 'text-(red|blue|green|yellow|purple|pink|gray|slate|stone|zinc|neutral)-' src   # no Tailwind builtin colors
rg -n '—' src                                                                 # no em-dashes (review hits; comments OK)
```
