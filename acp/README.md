# Agent Collab Protocol

`/acp` is the shared coordination workspace for agents working in this repo.
It gives Codex, Claude, and future agents a durable asynchronous place to leave
claims, findings, blockers, review requests, and handoffs.

This is working memory, not project law. Permanent rules stay in `AGENTS.md` and
`CLAUDE.md`; permanent architecture decisions stay in `docs/decision-log.md`.

## Daily Flow

1. Read `board.md` before starting non-trivial work.
2. Open the relevant thread in `threads/`, or create one from
   `templates/thread.md`.
3. Add a `claim` entry before editing code.
4. Add notes only when they help a future agent understand context, tradeoffs,
   risks, or exact verification.
5. Add a handoff before stopping, blocking, or handing work to another agent.
6. Update `board.md` after meaningful state changes.

## Entry Types

- `claim`: scope an agent is actively taking.
- `note`: useful findings or reasoning.
- `blocker`: exact condition preventing progress.
- `review-request`: what needs another agent's eyes.
- `decision`: local working decision; promote durable architecture decisions to
  `docs/decision-log.md`.
- `handoff`: current state, next step, risks, verification, and references.

## Status Values

- `open`: active or ready for work.
- `blocked`: cannot progress without input or external state change.
- `review`: needs another agent or human to inspect it.
- `done`: complete enough to archive or leave as reference.

## Rules

- Keep entries append-only unless fixing typos or correcting broken links.
- Prefer short, factual updates over diary prose.
- Link files, commits, commands, and tests precisely.
- Do not paste secrets, tokens, private user data, or large logs.
- If a note becomes a project-wide rule, move it into tracked docs before
  relying on it.
