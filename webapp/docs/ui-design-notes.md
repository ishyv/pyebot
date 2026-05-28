# UI design notes

Conventions introduced by the responsive + form-UX pass. The binding design law
(colors, type weight, lowercase copy, motion budget, no-raw-hex, etc.) lives in
[../CLAUDE.md](../CLAUDE.md) — this file only covers the patterns added here.

## Responsive breakpoints

Media queries can't read CSS custom properties, so the scale is a **convention**,
not a token. Use these two literals for everything below the desktop layout:

| Width | rem | Use for |
|-------|-----|---------|
| tablet | `48rem` | collapsing multi-column config grids; the guild nav switches to a drawer |
| phone | `40rem` | single-column form rows (list rows, two-column editor grids) |

Layout-level breakpoints that are driven by a specific wide composition are
**exceptions** and stay as-is: the guide page's 3-column reading layout
(`1180px`) and the overview / embed-editor wide splits (`min-width: 80rem`).
Don't fold those into the 40/48rem scale — they'd cramp between 768px and their
natural width.

## Mobile navigation

`GuildShell` shows the static sidebar above `48rem`. Below it, the sidebar is
hidden and a hamburger in the `Topbar` opens a HyvUI `Drawer` holding the same
`SidebarNav`. The drawer closes on backdrop dismiss, on picking an item
(`onnavigate`), and on any route change (an `$effect` keyed on `activePath`).
The icon-only hamburger carries a `.visually-hidden` label because HyvUI
`Button` has no `aria-label` passthrough.

## Form save UX

All config **save** forms go through the shared helper in
[../src/lib/forms.ts](../src/lib/forms.ts):

```svelte
use:enhance={enhanceSave({
  setSaving: (v) => (saving = v),
  resolve: () => sectionResolve,   // optional border flash
  okMessage: "section saved",
  setError: (e) => (sectionError = e),
})}
```

`enhanceSave` flips the saving flag, flashes the `use:resolve` border, toasts,
and — crucially — **surfaces the server's real error** instead of a generic
"save failed, retry". The pure `interpretSaveResult` maps the action result to
`{ ok, message, field? }` and is unit-tested in `src/lib/forms.test.ts`.

### Inline field errors

`dashboard-parsers.ts` reports the offending field name alongside the message
(`ParseResult` carries an optional `field`; the numeric helpers pass their
`key`). Server actions thread it through `fail(400, { …, field, error })`. The
page places it on the matching `FormField`:

```svelte
<FormField error={sectionError?.field === "cooldownHours" ? sectionError.message : undefined}>
```

Structural errors (JSON rules, file uploads, unknown enums) have no `field` and
render in an `Alert variant="error"` banner at the top of the form instead.

### Dirty state

Track dirty by comparing live `$state` against the **reactive loader value**
(`data.<section>`), via `isDirty(current, initial)`:

```svelte
const dirty = $derived(isDirty({ reward: dailyReward }, { reward: String(data.daily.reward) }));
```

A successful save reloads `data` (SvelteKit `update()`), so the marker clears
on its own — no manual reseed. The inputs are still seeded once with `untrack`
so an in-flight loader refresh can't clobber edits. While dirty, the actions row
shows a lowercase "unsaved changes" marker and a `reset` ghost button that
restores fields from `data`. **The save button stays enabled regardless.**

Per-row list forms (roles) route through `enhanceSave` for real error toasts but
skip the inline banner / dirty marker — they'd clutter the compact grid.

## Empty states

Use HyvUI `EmptyState` (title + description, lowercase) for "nothing here yet"
lists, not bare `<p>`. `Skeleton` covers client-fetched loading frames (see the
rpg item grid), and `ErrorState` covers fetch failures with a retry.
