# AI Engineering Docs

These files exist because agents are very talented at turning a small bug into a ceremonial temple of abstractions. Do not do that here.

## Purpose

This folder defines the engineering taste of the project:

- small code
- direct flows
- strict but useful TypeScript
- Zod only where runtime validation is needed
- documentation that explains why code exists
- refactors based on diagnosis, not panic edits

## Reading order

1. `engineering-principles.md`
2. `typescript-typing-and-validation.md`
3. `refactor-protocol.md`

For how RPG content is actually structured (runtime-mutable maps seeded from
static TypeScript, edited via the dashboard), see `docs/content-authoring.md`
and `docs/rpg-content-dashboard.md`.

## Default agent behavior

When assigned a refactor:

1. Trace the current behavior.
2. Identify root cause.
3. Delete or merge unnecessary layers.
4. Preserve behavior unless explicitly changing it.
5. Add comments where they explain reasoning.
6. Verify with meaningful checks.
7. Summarize what got simpler.

Do not add framework-shaped architecture just because the words “registry,” “service,” or “manager” sound employable.
