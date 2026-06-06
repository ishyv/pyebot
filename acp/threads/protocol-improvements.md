---
topic: protocol-improvements
status: open
owner: Claude
participants: [Claude, Vey]
updated: 2026-06-05
related_files: [acp/README.md, acp/templates/thread.md, acp/board.md]
related_commits: []
related_threads: [acp/threads/acp-protocol-trial.md]
---

# Protocol Improvements

## Context

After the inaugural ACP trial (see `threads/acp-protocol-trial.md`), four gaps
were identified. This thread implements them and — more importantly — records the
reasoning behind each one for Vey and any future agent arriving cold.

The user's intent is explicit: ACP exists so agents preserve the *why* behind
their decisions in natural language, not just as a code diff. This thread is an
example of that intent applied to the protocol itself.

## Entries

### 2026-06-05T00:00:00Z - Claude - claim

Scope: implement the four protocol improvements identified in the trial thread
and write reasoning notes for Vey so the intent survives beyond this session.

Intended next step: Vey reviews and either agrees, pushes back, or refines.

### 2026-06-05T00:00:00Z - Claude - note

**For Vey — on the `question` entry type.**

The problem the `blocker` type has is that it conflates two different situations:
"I literally cannot move forward" and "I could continue but I need a human to
make a call first." Both feel like blockers in the moment, but they're different
signals for whoever reads the board.

A `blocker` is a wall. A `question` is a fork — the agent picks a tentative path
and flags that the answer might redirect them. Separating these means the human
doesn't have to read every blocker row to find the ones that actually need them.
The `for:` field adds routing: if it's `for: human`, it's in the human's court.
If it's `for: Vey` or `for: Claude`, the other agent knows the ball is theirs
without scanning entry prose.

This is a small type addition, but it makes the board scannable as a triage
surface rather than a narrative log.

### 2026-06-05T00:00:00Z - Claude - note

**For Vey — on the promotion ritual.**

Good ACP notes have a half-life. They're most valuable in the week after they're
written, when the context is fresh and the reasoning is live. Six months later,
a closed thread nobody scans is just rotting context.

The failure mode is this: an agent writes a really good note in ACP — something
that should be in AGENTS.md forever — and then marks the thread done and moves
on. The note stays in the thread. Another agent starts work in the same area,
doesn't know to look at a closed thread, and reinvents or contradicts the rule.

The promotion ritual is one checklist item: when a note hardens into a permanent
rule, paste it into the real doc, commit it with a thread reference, and mark
the thread entry with a `promoted:` line. Two steps, but they close the loop.
Without them, ACP is a place where good ideas go to become invisible.

### 2026-06-05T00:00:00Z - Claude - note

**For Vey — on archiving.**

The active thread list in `board.md` is only useful if it's short enough to scan
in five seconds. If done threads accumulate in `acp/threads/`, you have to
distinguish "is this still relevant?" for every row before you can start work.
That friction compounds over months.

Archiving isn't deleting. The history is preserved in `acp/archive/`. The board
row disappears. The cost is one `git mv` when a thread closes. The benefit is
that the active list stays as a signal, not a log.

The `.gitkeep` in `acp/archive/` matters because it establishes the directory
in git before anyone needs it. The last thing an agent should have to do when
closing out a thread is remember to create the archive directory first.

### 2026-06-05T00:00:00Z - Claude - note

**For Vey — on `related_threads`.**

This one is the most speculative of the four, but it solves a real tracing
problem. Work in this codebase ripples: a migration spawns a design discussion,
the design discussion surfaces a bug, the bug fix has architectural implications
tracked in a third thread. Right now, the only way to trace that chain is to
grep for keywords — which requires already knowing what to grep for.

`related_threads` in the frontmatter is a lightweight fix. It costs nothing to
fill in when you know the connection exists. It pays out when an agent arrives
cold six weeks later and needs to understand why a decision was made the way it
was. One field, navigable knowledge graph instead of an implicit one.

Worth noting: the field is optional and nobody should feel obligated to list
every tangentially related thread. The bar is "would an agent arriving cold
benefit from knowing this connection?" If yes, link it.

### 2026-06-05T00:00:00Z - Claude - handoff

State:
- All four improvements implemented.
- `acp/README.md`: added `question` entry type, Promotion Ritual section,
  Archiving section.
- `acp/templates/thread.md`: added `related_threads` frontmatter field, added
  `question` template entry.
- `acp/board.md`: added this thread's row, added archiving working rule.
- `acp/archive/.gitkeep`: created to establish the archive directory in git.
- This thread: four reasoning notes written for Vey, one per improvement.

Verified:
- No source code touched. `bun run typecheck` and `bun run check` should pass
  unchanged.
- Scaffold files all present under `acp/`.

Remaining:
- Vey: read the four reasoning notes and validate that the mental models match
  your experience of where the original protocol was thin. Push back in a `note`
  entry here if anything is wrong or if you'd frame it differently.
- Either agent: the `acp-protocol-trial` thread is in `review` status. Once the
  user signs off on both that thread and this one, both can be archived.

Risks:
- The promotion ritual only works if agents actually do it. It's a convention,
  not enforcement. If a future agent skips the `promoted:` field, the link is
  lost. Keeping the ritual short (two steps) is the main mitigation.

References:
- `acp/README.md`
- `acp/templates/thread.md`
- `acp/board.md`
- `acp/archive/.gitkeep`
- `acp/threads/acp-protocol-trial.md`
