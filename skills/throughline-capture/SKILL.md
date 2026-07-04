---
name: throughline-capture
description: "Use to park a pending idea or checkpoint a phase boundary into the project's throughline (backlog) so a future fresh session can act on it without re-explanation. Triggers: 'park this', 'add to backlog', 'throughline this', '/throughline add', '/throughline checkpoint', or finishing a phase in a long session."
license: MIT
---

# throughline — Capture

Capture pending work so a **cold future session** can execute it without you
re-explaining. Two flavors: **park** (something for later) and **checkpoint**
(a handoff at a phase boundary). Read `${CLAUDE_PLUGIN_ROOT}/references/item-schema.md`
before writing any item file.

**Core principle — point, don't summarize.** Record only what a fresh session
*cannot* re-read from the code or the plan file: the *why*, the decisions, the
gotchas, the deviations. Never restate what `git diff` already shows.

## Park (a new item)

1. Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/new-item.mjs "<short title>"`. It creates
   `.throughline/NNNN.md` with the id and the current git SHA pre-stamped, and prints the path.
2. Open that file and fill it in **from the conversation you are already in** — do not
   ask the user to retype what was just discussed. Harvest:
   - `intent`: what and, above all, *why it matters*.
   - `decisions`: choices already settled ("must use X", "don't touch Y").
   - `open_questions`: anything genuinely unresolved. Ship will ask only these.
   - `acceptance`: done-when.
   - `anchors.files`: the paths the work touches (ground truth for a cold session).
3. Confirm in one line: "Parked [id] <title>." Do not start implementing.

## Checkpoint (a phase handoff)

Use at the end of a phase in a long session, when the next phase should run fresh.

1. Identify the item (its `anchors.plan` is the source of truth). If the phased work
   isn't tracked yet, park it first with a `plan:` anchor pointing at the plan file.
2. Set the finished phase's `status: done` and write its `delta` — **only** the
   irreducible handoff: decisions made this phase, gotchas, and any deviation from the
   plan *and why*. Do not summarize the code; the next session reads the diff and the plan.
3. Ensure the next phase exists with `status: pending`.
4. Confirm: "Checkpointed [id] at <phase>. A fresh session can resume with /throughline ship <id>."

## Never

- Never dump a prose recap of the code into `delta`/`intent` — that reintroduces the
  lossy-handoff drift this exists to prevent.
- Never begin implementation from Capture. Capture records; Ship executes.
