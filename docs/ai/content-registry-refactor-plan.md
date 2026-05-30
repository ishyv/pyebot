# Content Registry Refactor Plan

## Problem

The current gathering/content flow appears over-abstracted.

Observed failure shape:

- the gather command required a raw location ID instead of presenting a location select menu
- the flow jumps from command wrapper to generic gather function to location lookup to registry object to sourced location alias to Zod-derived schema
- this creates a long call chain for a simple domain action: choose a valid gathering location, gather resources, update the profile
- the code uses Zod schemas as if they were the domain model, instead of using TypeScript types for trusted internal data and Zod only for runtime boundaries
- functions lack useful comments explaining why each layer exists

The desired result is a smaller, direct flow that a developer can understand from command input to gathering result.

## Design goals

1. The command should show valid locations as select menu options when a location is not selected.
2. A selected value should be narrowed once from `string` to `LocationId`.
3. Domain logic should receive trusted types, not arbitrary strings.
4. Static content should be represented with typed constants.
5. Zod should only parse untrusted runtime content.
6. The content registry should become a plain typed content module unless dynamic content loading truly requires a registry.
7. The call path should be short enough to trace without archaeology.

## Proposed target shape

Suggested module shape:

```txt
src/rpg/content/
  locations.ts        # typed static location data and lookup helpers
  materials.ts        # typed static material data
  indexes.ts          # optional derived indexes, only if needed

src/rpg/gathering/
  gather.ts           # domain gathering behavior
  gathering.types.ts  # small domain result/error types if needed

src/commands/rpg/
  gather.command.ts   # Discord command UX and select menu handling
```

Only keep a `content-registry` module if the project supports external content packs loaded at runtime. If content is shipped with the bot, a registry class is unnecessary.

## Example content model

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
  pine_forest: {
    name: "Pine Forest",
    action: "woodcut",
    profession: "woodcutting",
    requiredTier: 1,
    materials: ["pine_log"],
  },
} as const satisfies Record<string, LocationDef>;

export type LocationId = keyof typeof LOCATIONS;
```

## Example lookup helpers

```ts
/**
 * Runtime boundary for user-selected location IDs.
 * Keeps arbitrary Discord strings out of gathering domain logic.
 */
export function parseLocationId(value: string | undefined): LocationId | null {
  return value && value in LOCATIONS ? (value as LocationId) : null;
}

/**
 * Returns only locations usable by a gathering action.
 * Used by command UI to build select menu options and by input narrowing.
 */
export function locationsForAction(action: GatherAction) {
  return Object.entries(LOCATIONS)
    .filter(([, location]) => location.action === action)
    .map(([id, location]) => ({ id: id as LocationId, ...location }));
}

/**
 * Narrows a raw selected value to a location that belongs to the requested action.
 */
export function parseLocationForAction(
  value: string | undefined,
  action: GatherAction,
): LocationId | null {
  const id = parseLocationId(value);
  return id && LOCATIONS[id].action === action ? id : null;
}
```

## Example command UX

The command should not force users to know internal IDs.

```ts
export async function handleMineCommand(userId: string, selectedLocation?: string) {
  const locationId = parseLocationForAction(selectedLocation, "mine");

  if (!locationId) {
    return showLocationSelect("mine");
  }

  return gatherAtLocation(userId, locationId);
}
```

The select menu options come from the same typed data:

```ts
function locationOptions(action: GatherAction) {
  return locationsForAction(action).map((location) => ({
    label: location.name,
    value: location.id,
    description: `Tier ${location.requiredTier}`,
  }));
}
```

## Example domain function

```ts
/**
 * Performs gathering at a validated location.
 * Assumes `locationId` has already been narrowed at the command/input boundary.
 */
export async function gatherAtLocation(
  userId: string,
  locationId: LocationId,
): Promise<Result<GatheringResult, GatherError>> {
  const profile = await getRequiredRpgProfile(userId);
  const location = LOCATIONS[locationId];

  // Continue with requirement checks, drop rolling, and persistence.
}
```

Notice the important part: the domain function does not call a registry, then a provider, then a mapper, then a schema-derived alias just to read a location. Humanity survives another day.

## What to delete or merge

Look for these candidates:

- wrappers like `mine(...) → gather(..., "mine")` if command handlers can call the correct domain helper directly
- `getLocation` wrappers that only adapt one registry shape into the same shape
- `SourcedLocationDef` usage where source tracking is not needed by the caller
- registry classes that only wrap static content maps
- Zod schemas used only to produce internal TypeScript types
- duplicate `LocationDef`/`RawLocationDef`/`SourcedLocationDef` chains where only one domain type is needed

## When to keep Zod

Keep or add Zod only when:

- locations are loaded from JSON at runtime
- content packs can be added by users/admins/plugins
- DB records need runtime validation
- command payloads need runtime parsing beyond basic string narrowing

Do not make every internal function accept `z.infer<typeof SomeSchema>`.

## Migration steps

1. Map current command flow for mining and woodcutting.
2. Identify all content registry entrypoints actually used.
3. Create or simplify typed content constants for locations/materials.
4. Derive `LocationId` and related IDs from typed data.
5. Add small input-narrowing helpers for raw Discord values.
6. Update gather command:
   - no selected location → show select menu
   - selected location → narrow and gather
7. Collapse or delete registry layers not needed by the new flow.
8. Move Zod schemas to runtime boundary modules only, if still needed.
9. Add JSDoc comments to exported helpers and non-obvious invariants.
10. Run typecheck/lint and focused command checks.

## Definition of done

- `/gather mine` does not require a user to manually provide an internal location ID.
- The command can present valid location options from typed content.
- Gathering logic accepts a narrowed `LocationId`.
- Static content is typed with TypeScript, not modeled primarily through Zod.
- The content lookup flow is direct and readable.
- The refactor removes more code than it adds, unless there is a documented reason.
- Exported functions/types have concise comments where reasoning matters.
