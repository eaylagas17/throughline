---
name: throughline-ship
description: "Use when the user picks a throughline item to implement (e.g. '/throughline ship 0007', 'work on the auth migration', 'resume phase 2'). Cold-starts the item from its captured context, re-validates against the plan, then implements minimally. Not for capturing; that's throughline-capture."
license: MIT
---

# throughline: Ship

Execute a picked item from a **cold start**, staying faithful to the plan. The whole
point is that a fresh session resumes phased work *without drifting*, so reconstruct
from ground truth, not from a prose recap.

## Protocol (in order)

1. **Load the item.** Read `.throughline/<id>.md` in full (frontmatter *and* body:
   decisions, open_questions, per-phase delta). If it has `anchors.plan`, read that plan
   file: it is the **source of truth** for what each phase must be.
2. **Reconstruct from ground truth.** Read `anchors.files`. For a phased item, read the
   `delta` of completed phases and the actual diff; do not trust any summary over the code.
3. **Check drift.** Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/drift-check.mjs`. If the item is
   stale, tell the user what changed before proceeding.
4. **Re-validate BEFORE writing.** State, in one or two lines, your understanding of the next
   phase and confirm it matches the plan file. If it does not match, surface the mismatch and
   stop; do not write code past a drift. (This is the step that prevents fresh-session drift.)
5. **Resolve gaps.** Read the codebase first. Ask the user **only** the item's `open_questions`
   plus any *new* decision-level ambiguity. Never re-ask what capture already recorded.
6. **Implement minimally.** Compose the ponytail ladder: reuse/stdlib/native/one-line before
   writing new code. Ship the smallest change that satisfies `acceptance`.
7. **Report & update.** State what changed. Update the item: advance `phases[].status`, set
   `status: done` when acceptance is met, or checkpoint (hand to throughline-capture) if you
   stopped at a phase boundary.

## Safety carve-outs (never cross)

- Stop and confirm before anything destructive or irreversible.
- Never guess on decision-level ambiguity; ask.
- If drift is detected at step 4, surface it; do not proceed on a stale understanding.
- `ponytail` shortens the *solution*, never the *reading* or the safety guards
  (validation, error handling, security, accessibility).

## Degradation

In Claude Code you may fan out subagents for independent sub-tasks of this one item.
In Codex, run sequentially. Never fan out across *multiple* items; one picked item at a time.
