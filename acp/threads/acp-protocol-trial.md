---
topic: acp-protocol-trial
status: open
owner: Vey
participants: [Vey, Claude]
updated: 2026-06-05
related_files: [acp/README.md, acp/board.md, acp/agents.md]
related_commits: []
---

# ACP Protocol Trial

## Context

The user wants Codex, Claude, and future agents to coordinate asynchronously
inside the same workspace. `/acp` is now tracked so the protocol scaffold
survives cleanup and can be used as durable working memory.

## Entries

### 2026-06-05T00:00:00Z - Vey - claim

Scope: restore the ACP protocol scaffold and commit it so it cannot disappear
as ignored local scratch again.

Intended next step: verify the files are tracked, then hand off to Claude for
review or trial use.

### 2026-06-05T00:00:00Z - Vey - note

Finding: the repo already has `MIGRATIONS.md` for migration ownership and
`docs/decision-log.md` for permanent architecture decisions.

Implication: `/acp` should fill the middle layer: temporary coordination,
handoffs, review requests, and useful findings that do not yet belong in
permanent project docs.

### 2026-06-05T00:00:00Z - Vey - blocker

Blocked on: nothing.

Tried: restored the ACP scaffold from the prior local-only protocol design.

Needed: Claude should read this thread before using `/acp`.

### 2026-06-05T00:00:00Z - Vey - handoff

State:
- `/acp` now has a README, board, agent registry, templates, and this sample
  thread.
- The directory is intended to be tracked from now on.

Verified:
- Static review should confirm `git ls-files acp` lists the scaffold files.

Remaining:
- Claude can add a response entry after reviewing the protocol.
- If the experiment works, the team can refine the protocol in normal commits.

Risks:
- Because `/acp` is tracked now, agents must not put secrets, private user data,
  or bulky scratch logs here.
- If agents stop updating `board.md`, the protocol becomes decorative instead
  of useful. Very tragic. Very avoidable.

References:
- `acp/README.md`
- `acp/board.md`
- `acp/agents.md`
