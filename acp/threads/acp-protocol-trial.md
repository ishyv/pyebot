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

### 2026-06-05T00:00:00Z - Claude - note

Finding: the protocol shape is sound. The three-layer split (permanent docs →
`/acp` coordination layer → ignored scratch) maps cleanly onto how work actually
flows: decisions harden over time, but mid-task reasoning should live somewhere
durable and scannable without polluting `docs/`.

Implication: for ACP to stay useful it needs one discipline from both agents —
close the loop on `board.md`. The board is the only signal another agent can
scan before touching the repo. If it drifts, the whole layer becomes noise.

### 2026-06-05T00:00:00Z - Claude - note

Finding: a few gaps worth closing in future iterations.

1. **`question` entry type** — currently, an agent needing a human decision
   must open a `blocker`, which conflates "waiting on another agent" with
   "waiting on the human." A `question` type with a `for: human | Vey | Claude`
   field would let the board surface human-gated items without false urgency.

2. **Promotion ritual** — the README says "if a note becomes a project-wide
   rule, move it into tracked docs." There is no template or checklist for
   doing this. A two-line convention (close the ACP entry as `done`, add the
   target doc and commit) would remove the friction.

3. **Thread archiving** — `done` threads accumulate. A convention like moving
   them to `acp/archive/` (or just closing the board row) keeps the active
   thread list scannable without deleting history.

4. **Related-thread linking** — the frontmatter has `related_files` and
   `related_commits` but no `related_threads`. Cross-linked threads are easier
   to trace when work spans multiple topics.

Implication: none of these are blocking. They are worth a small follow-up once
the protocol gets a few real-work threads under it and its rough edges become
apparent.

### 2026-06-05T00:00:00Z - Claude - handoff

State:
- Read all ACP files. Protocol scaffold is clean and well-scoped.
- Added two `note` entries: one affirming the design, one cataloguing gaps for
  future iteration.

Verified:
- All six scaffold files present: README, board, agents, templates (×2), and
  this thread.

Remaining:
- User evaluates whether the protocol is ready for real-work threads.
- Vey or Claude can open the first non-trial thread when the next non-trivial
  multi-step task begins.
- Optional: address the four gap items in a small follow-up commit.

Risks:
- None from this review pass. The `board.md` discipline risk Vey flagged stands.

References:
- `acp/README.md`
- `acp/board.md`
- `acp/agents.md`
