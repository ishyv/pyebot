# Engineering Principles

## North star

The best version of this codebase is not the one with the most abstractions. It is the one where a competent developer can trace a command from user input to result without opening seven files and questioning civilization.

Prefer boring, direct, typed code.

## What “senior” means here

A senior engineer in this codebase:

- deletes unnecessary code
- makes behavior visible
- uses types to encode real domain constraints
- chooses simple data structures before creating systems
- writes comments for non-obvious reasoning
- refuses abstractions that do not reduce total complexity
- understands the cause of a bug before touching the fix

A senior engineer does **not**:

- add layers because “future scalability”
- create classes around plain records
- create type aliases that only rename other aliases forever
- write tests that only prove mocks exist
- split five lines into five files for vibes

## Simplicity hierarchy

When solving a problem, prefer this order:

1. **Delete code** if it is unnecessary.
2. **Use existing language features** before libraries.
3. **Use plain objects, arrays, and functions** before classes.
4. **Use discriminated unions / literal types** before runtime branching.
5. **Use runtime validation only at untrusted boundaries.**
6. **Add abstractions only when they remove repeated decisions**, not merely repeated syntax.

## Abstraction rule

An abstraction is allowed only if it satisfies at least one of these:

- It removes duplicated domain decisions.
- It hides genuinely ugly external API details.
- It protects an invariant that TypeScript cannot express cleanly.
- It creates a single obvious place to change behavior.
- It reduces the number of concepts a reader must hold in their head.

If an abstraction only forwards calls, renames values, or makes the call stack deeper, remove it.

## Function design

Prefer functions that do one domain-relevant thing.

Bad:

```ts
export async function mine(userId: string, locationId: string) {
  return gather(userId, locationId, "mine");
}
```

This is acceptable only if `mine` is part of a public command API and avoids exposing the lower-level action argument. Otherwise it is just a decorative hallway.

Better:

```ts
export async function gatherAtLocation(
  userId: string,
  locationId: LocationId,
): Promise<Result<GatheringResult, GatherError>> {
  // Domain work happens here.
}
```

Or, when commands need different UX:

```ts
export async function handleMineCommand(userId: string, selected?: string) {
  const locationId = parseLocationId(selected, "mine");
  if (!locationId) return chooseLocation("mine");

  return gatherAtLocation(userId, locationId);
}
```

## Error handling

Use typed errors when callers make decisions based on the error.

Do not create deep error class hierarchies unless they reduce branching. Most project-level errors can be:

```ts
type GatherError =
  | { code: "PROFILE_NOT_FOUND"; message: string }
  | { code: "LOCATION_NOT_FOUND"; message: string }
  | { code: "WRONG_ACTION"; message: string };
```

Classes are acceptable when they carry behavior or integrate with existing infrastructure. Otherwise, union types are clearer.

## Comments

Comments are required where code has intent that is not obvious from syntax.

Comment:
- why this path exists
- why a shortcut is safe
- why a validation boundary is here
- what invariant a type protects
- why a limitation is intentionally not fixed

Do not comment:
- direct restatements of function names
- obvious loops
- obvious assignments

## The refactor standard

A successful refactor should usually result in:

- fewer files or fewer exported symbols
- fewer call layers
- fewer duplicate domain types
- fewer runtime checks in trusted code
- clearer command-to-domain flow
- more helpful comments
- equal or better behavior
