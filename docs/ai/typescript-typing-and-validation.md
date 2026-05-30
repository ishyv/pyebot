# TypeScript Typing and Runtime Validation

## Core rule

Use TypeScript types to model trusted domain data.

Use Zod to validate untrusted runtime data.

Do not use Zod schemas as a replacement for normal TypeScript types across the domain layer. That turns type safety into a paperwork factory, which is exactly how codebases become cursed furniture.

## Boundary model

### Trusted compile-time data

For static content inside the repo, prefer `as const satisfies`.

```ts
export type GatherAction = "mine" | "woodcut";

export interface LocationDef {
  name: string;
  action: GatherAction;
  requiredTier: 1 | 2 | 3 | 4;
  materials: readonly MaterialId[];
}

export const LOCATIONS = {
  copper_mine: {
    name: "Copper Mine",
    action: "mine",
    requiredTier: 1,
    materials: ["copper_ore"],
  },
  pine_forest: {
    name: "Pine Forest",
    action: "woodcut",
    requiredTier: 1,
    materials: ["pine_log"],
  },
} as const satisfies Record<string, LocationDef>;

export type LocationId = keyof typeof LOCATIONS;
```

This gives:
- checked object shape
- literal IDs
- autocomplete
- no runtime parser for data already shipped with the code

### Untrusted external data

Use Zod when data comes from:
- JSON files loaded at runtime
- database records
- Discord/user input
- network/API payloads
- plugin/mod content not compiled with the project

```ts
import { z } from "zod";

const RawLocationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  action: z.enum(["mine", "woodcut"]),
  requiredTier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  materials: z.array(z.string()).default([]),
});

type RawLocation = z.infer<typeof RawLocationSchema>;
```

Then convert raw validated data into domain data at the boundary:

```ts
function loadExternalLocations(input: unknown): Record<string, LocationDef> {
  const parsed = z.array(RawLocationSchema).parse(input);

  return Object.fromEntries(
    parsed.map(({ id, ...location }) => [id, location]),
  );
}
```

After this conversion, internal code should use domain types, not keep dragging Zod everywhere like a shopping cart with one broken wheel.

## Narrowing user input

Discord/user input is stringly typed. Narrow it once.

```ts
export function isLocationId(value: string): value is LocationId {
  return value in LOCATIONS;
}

export function parseLocationId(value: string | undefined): LocationId | null {
  return value && isLocationId(value) ? value : null;
}
```

If the location must also match an action:

```ts
export function parseLocationForAction(
  value: string | undefined,
  action: GatherAction,
): LocationId | null {
  const id = parseLocationId(value);
  return id && LOCATIONS[id].action === action ? id : null;
}
```

After this point, domain code receives `LocationId`, not arbitrary `string`.

## Prefer derived types

When content is static, derive IDs from data:

```ts
export type LocationId = keyof typeof LOCATIONS;
export type MaterialId = keyof typeof MATERIALS;
```

This prevents invalid hardcoded IDs without needing runtime schemas everywhere.

## Avoid alias chains

Bad:

```ts
type SourcedLocationDef = Sourced<LocationDef>;
type RegistryLocation = SourcedLocationDef;
type LocationEntry = RegistryLocation;
```

This hides the shape without adding safety.

Better:

```ts
type ContentSource = "core" | "external";

type Sourced<T> = T & {
  source: ContentSource;
};
```

Use the alias only where source tracking matters. Do not make every call path pay for it.

## Branded types

Use branded types sparingly.

Good use:
- IDs loaded from a database and validated once
- opaque values that must not mix accidentally

Bad use:
- every string in the system
- static object keys already typed by `keyof typeof DATA`

## Type complexity budget

A type is too clever when:
- reading it takes longer than reading the runtime code it replaces
- it requires helper types only used once
- it creates `as unknown as` escape hatches
- it hides rather than clarifies the domain

TypeScript should make illegal states unrepresentable. It should not make legal states unreadable.
