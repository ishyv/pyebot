# Agent Prompt: Refactor Gathering and Content Registry

Use this prompt when assigning the refactor to an implementation agent.

---

You are working in a TypeScript Discord bot codebase. Your task is to refactor the RPG gathering/content registry flow so it is smaller, clearer, and more type-safe without adding ceremonial architecture.

Before editing, read:

- `AGENTS.md`
- `docs/ai/engineering-principles.md`
- `docs/ai/typescript-typing-and-validation.md`
- `docs/ai/refactor-protocol.md`
- `docs/ai/content-registry-refactor-plan.md`

## Goal

Fix the gathering/content flow by simplifying the content registry and using TypeScript types properly.

The current problem: gathering commands require raw location IDs and the code path goes through too many layers: command wrapper → generic gather function → location lookup wrapper → content registry → sourced type alias → Zod-derived schema. This is bloated and makes the behavior hard to reason about.

The desired behavior: when the user runs a gather command like mining, the command should present valid location choices through a select menu if no location is selected. When a location is selected, narrow the raw string into a typed `LocationId` once, then pass that trusted ID into gathering domain logic.

## Engineering constraints

- Prefer deleting/merging code over adding new abstractions.
- Do not create new manager/provider/registry classes unless they remove real complexity.
- Use `as const satisfies` for static content data when content is compiled with the bot.
- Derive IDs from static content with `keyof typeof DATA`.
- Use Zod only for untrusted runtime boundaries: JSON files, DB records, plugin content, network payloads, or raw command payloads that need validation.
- Do not use Zod schemas as the default source of internal domain types.
- Do not create alias chains like `SourcedLocationDef → Sourced<LocationDef> → z.infer<...>` unless each layer has a necessary purpose.
- Add concise JSDoc comments to exported functions/types and non-obvious helpers.
- Preserve existing behavior unless explicitly changing the UX to show select menus instead of requiring raw IDs.
- Do not add fake tests. Add focused tests/checks only where they protect actual behavior.

## Required first response before edits

Produce this note before code changes:

```md
## Diagnosis
- Current command flow:
- Root cause:
- Unnecessary layers found:
- Runtime boundaries:
- Static trusted data:

## Proposed refactor
- New module shape:
- Types to derive:
- Runtime validation/narrowing helpers:
- Code to delete/merge:
- Behavior to preserve:

## Verification plan
- Commands:
- Typecheck/lint:
- Focused tests/manual checks:
```

## Implementation target

Prefer a shape similar to:

```txt
src/rpg/content/
  locations.ts
  materials.ts
  indexes.ts     # only if useful

src/rpg/gathering/
  gather.ts
  gathering.types.ts

src/commands/rpg/
  gather.command.ts
```

This shape is not mandatory if the existing repo layout suggests a cleaner equivalent. Do not reorganize unrelated folders just to satisfy this exact tree.

## Expected content model

Use TypeScript domain types and typed constants:

```ts
export type GatherAction = "mine" | "woodcut";

export interface LocationDef {
  name: string;
  action: GatherAction;
  profession: Profession;
  requiredTier: 1 | 2 | 3 | 4;
  materials: readonly MaterialId[];
}

export const LOCATIONS = {
  copper_mine: {
    name: "Copper Mine",
    action: "mine",
    profession: "mining",
    requiredTier: 1,
    materials: ["copper_ore"],
  },
} as const satisfies Record<string, LocationDef>;

export type LocationId = keyof typeof LOCATIONS;
```

Use boundary helpers:

```ts
export function parseLocationId(value: string | undefined): LocationId | null {
  return value && value in LOCATIONS ? (value as LocationId) : null;
}

export function parseLocationForAction(
  value: string | undefined,
  action: GatherAction,
): LocationId | null {
  const id = parseLocationId(value);
  return id && LOCATIONS[id].action === action ? id : null;
}
```

Use command helpers to build select menus from the same typed content:

```ts
export function locationOptions(action: GatherAction) {
  return locationsForAction(action).map((location) => ({
    label: location.name,
    value: location.id,
    description: `Tier ${location.requiredTier}`,
  }));
}
```

Domain gathering should receive trusted values:

```ts
export async function gatherAtLocation(
  userId: string,
  locationId: LocationId,
): Promise<Result<GatheringResult, GatherError>> {
  const location = LOCATIONS[locationId];
  // load profile, check requirements, roll drops, persist result
}
```

## What to avoid

Do not respond to this task by creating:

- another content registry wrapper
- another generic service layer
- a mapper that maps the same shape into the same shape
- Zod schemas for static content already checked by TypeScript
- a pile of tiny files where each file contains one trivial helper
- tests that only assert implementation details

## Definition of done

- The gather command no longer requires raw user-entered location IDs for normal use.
- Valid locations are shown as selectable options.
- Raw selected values are narrowed at the command/input boundary.
- Gathering domain logic operates on typed IDs and clear content data.
- Zod is restricted to runtime boundaries.
- The call path is shorter and easier to trace.
- Unnecessary wrappers/classes/type aliases are deleted or merged.
- Exported functions/types have concise comments where reasoning matters.
- The final summary lists deleted/merged code, behavior changes, intentional non-changes, and verification results.
