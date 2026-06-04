# Agent Rules for This Codebase

This codebase values small, clear, typed, documented code over “enterprise-looking” architecture.

The goal is not to add more layers. The goal is to make the existing behavior easier to understand, safer to change, and harder to bloat.

## Workflow rule

Do not create branches for this project unless the user explicitly asks for one.
Work on `main`, keep changes scoped, and commit coherent checkpoints along the
way.

## Non-negotiable engineering values

1. **Less code wins** when behavior stays clear and correct.
2. **Types should remove code**, not create ceremonies around code.
3. **Runtime validation belongs at runtime boundaries**, not inside every domain function.
4. **One direct path beats five clever wrappers.**
5. **Comments explain purpose, invariants, and tradeoffs**, not obvious syntax.
6. **Fix root causes**, not symptoms created by previous fixes.
7. **Do not add tests just to perform testing theater.** Add tests only where they protect real behavior, edge cases, or refactors.

## Required workflow before editing

Before changing code, write a short implementation note in your response:

```md
## Diagnosis
- What is the actual problem?
- What code path creates it?
- Is it a symptom of a deeper design issue?

## Proposed shape
- What will be deleted, merged, or simplified?
- What types/invariants will replace runtime glue?
- What behavior must stay the same?

## Risk
- What could break?
- What commands/tests/manual checks will verify it?
```

Do not start editing until the diagnosis identifies the root cause.

## Subcommand dispatch — enforced pattern

`if (c.subcommand === "x")` chains are **banned**. The language has direct tools:

**Case A — handler functions already exist as `(interaction, ctx)` params:**
```ts
type Handler = (interaction: ChatInputCommandInteraction, ctx: Ctx) => Promise<void>;
const dispatch: Record<string, Handler> = {
  play: handlePlay,
  collect: handleCollect,
  // group subcommands use compound key:
  "prompt:reaction": (i, c) => handlePrompt(i, c, "reaction"),
};
.run(async (c) => {
  const key = c.subcommandGroup ? `${c.subcommandGroup}:${c.subcommand}` : (c.subcommand ?? "");
  await dispatch[key]?.(c.interaction, c.ctx);
});
```

**Case B — logic lives inline (no separate handler function):**
```ts
.subcommand({
  name: "add",
  description: "...",
  options: s => s.user("user", ...).string("reason", ...),
  run: async (c) => {
    const { user, reason } = c.options; // typed to this subcommand only
  },
})
```

Use object subcommand `run` for inline logic. Use `.handle(name, fn)` or the `dispatch` dict for existing handler functions. Never write `if (c.subcommand === "x") { … }`.

## Bloat detection checklist

Remove or redesign code when you find:

- A function that only forwards arguments without adding a domain decision.
- A class that only wraps a record/map and creates ceremony.
- Zod schemas used as the main source of normal TypeScript domain types.
- Several aliases that hide the actual shape without adding safety.
- Duplicate models for the same concept unless they represent different boundaries.
- “Manager,” “Registry,” “Service,” or “Provider” objects with no meaningful state or lifecycle.
- Tests that only assert mocks were called or that TypeScript compiled.

## Commenting rules

Every exported function, exported type, and non-trivial domain helper needs a short JSDoc comment.

Good comments explain:
- Why this abstraction exists.
- What invariant it protects.
- What input boundary it assumes.
- What tradeoff was accepted.

Bad comments repeat the code:
```ts
// Gets the location by id
function getLocation(id: string) { ... }
```

Good comment:
```ts
/**
 * Resolves a user-selected location after command input has been narrowed.
 * Runtime callers must validate arbitrary strings with `parseLocationId` first.
 */
function getLocation(id: LocationId): LocationDef { ... }
```

## Writing human-looking code

Code here should read as if a careful human teammate wrote it — not as machine output. Avoid the common AI tells:

- **Match the file you're in.** Reuse its naming, import style, and structure before introducing a new idiom. New code should be indistinguishable from the code around it.
- **Reuse the existing vocabulary and helpers.** Respond with `v2Message`/`container`/`section` or `ctx.respond`; narrow input with the catalog `parseXId` helpers; return `Result` where the layer already does. Don't hand-roll what the codebase already provides.
- **No comment that restates the code.** Comment *why*, an invariant, or a boundary assumption — never the obvious "what". (See "Commenting rules".)
- **No defensive theater.** Don't add `try/catch` that only rethrows or logs-and-swallows, null checks for values the types already guarantee, or `as any` to quiet the compiler. Fix the type or validate once at the boundary.
- **No speculative generality.** Build for the case in front of you, not an imagined future one. No `Manager`/`Provider`/`Registry` wrappers without real state or lifecycle.
- **Surgical diffs.** Change only what the task needs. Don't reformat, re-sort imports, or rewrite untouched lines — it hides the real change and fights Biome.
- **No decoration.** No emoji, ASCII banners, or "Step 1 / Step 2" narration in code or comments. Keep prose plain and lowercase-first like the rest of the tree.
- **Stay consistent with the chosen pattern.** If a sibling command uses the `dispatch` dict for subcommands, the new one does too. Consistency reads as authored intent.

## Files to read before refactors

Read these before a non-trivial refactor:

- `docs/ai/engineering-principles.md`
- `docs/ai/typescript-typing-and-validation.md`
- `docs/ai/refactor-protocol.md`

Before modifying RPG content/gathering specifically, also read
`docs/content-authoring.md` and `docs/rpg-content-dashboard.md` — content is
runtime-mutable (static TS seeds a Mongo-backed snapshot the dashboard edits),
not compile-time constants.
