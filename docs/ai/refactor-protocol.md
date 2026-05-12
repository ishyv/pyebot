# Refactor Protocol for Agents

This is the required process for non-trivial refactors.

## 1. Trace the behavior first

Before editing, identify:

- command entrypoint
- user input shape
- domain function called
- data lookup path
- mutation/persistence path
- response/UI path

Write the trace in plain language.

Example:

```md
/gather mine
→ receives userId and optional selected location
→ if no location selected, should show valid mining locations
→ if selected, validate selected ID belongs to mining
→ load profile
→ resolve location
→ roll drops
→ update profile
→ return result
```

If the trace cannot be written simply, the code is probably too indirect.

## 2. Diagnose root cause

Do not patch the first visible bug.

Ask:

- Is this a UI/command problem?
- Is this a type boundary problem?
- Is this a data modeling problem?
- Is this caused by an abstraction hiding the real flow?
- Did a previous fix create the current bug?

The fix should target the highest useful layer.

## 3. Choose refactor scope

Use the smallest scope that removes the root cause.

Allowed refactor scopes:

- **Local cleanup:** one file or one function.
- **Vertical slice:** one behavior from command input to result.
- **Boundary cleanup:** one input/data validation boundary.
- **Model cleanup:** one duplicated domain model.
- **System simplification:** remove a whole abstraction when it does not earn its existence.

Do not rewrite unrelated systems because you saw ugly code nearby. The codebase is not a buffet of suffering.

## 4. Design before code

Before editing, produce:

```md
## Refactor target
[system or command]

## Root cause
[actual cause]

## New shape
[short design]

## Deletions
[files/functions/types expected to be removed or merged]

## Preserved behavior
[what must stay the same]

## Verification
[commands/manual checks/tests]
```

## 5. Edit for deletion first

Prefer these actions:

- inline wrappers that only forward arguments
- merge duplicate type aliases
- replace classes with plain records/functions when there is no lifecycle
- move runtime parsing to boundary functions
- use `as const satisfies` for static content
- collapse “registry → provider → source → def” chains when one map is enough

## 6. Document reasoning while editing

Add JSDoc to exported/non-trivial pieces.

Keep comments short. The goal is not to turn code into a legal deposition.

Required comment targets:

- exported domain functions
- exported domain types when invariants are not obvious
- runtime validation/parsing boundaries
- any intentionally accepted limitation
- any function whose name cannot fully explain its reason for existing

## 7. Verify meaningfully

Use checks that prove behavior, not vibes.

Preferred:
- typecheck
- lint/format
- focused tests around changed behavior
- small command simulation/manual check
- assertions for edge cases that previously broke

Avoid:
- adding mocks that only confirm mocks were called
- snapshot spam
- giant unrelated test suites before a focused refactor
- changing behavior and calling it cleanup

## 8. Summarize the result

Final summary must include:

- what got simpler
- what was deleted/merged
- what behavior changed, if any
- what was intentionally left alone
- verification performed
