# `/backlog` — Design Spec

**Date:** 2026-07-03
**Status:** Approved for planning
**Working name:** `backlog` (final name is an open decision — see §12)

---

## 1. The problem

Pending work loses its context between sessions. Two flavors of the same pain:

1. **Parked ideas evaporate.** You want to build something "later." Later arrives in a fresh session with none of the *why*, the decisions already made, or the relevant files — so you re-explain it from scratch, badly.

2. **Phase handoffs drift (the killer).** Phase 1 of a multi-phase implementation eats your context window. To continue token-efficiently you ask the agent to *write a handoff prompt* to paste into a fresh session for Phase 2. You do it — and the fresh session **still drifts from the plan**, because the handoff wasn't faithful.

Why the manual handoff drifts:
- It's **prose summarized from an already-degraded context window** — a saturated session compressing itself. Summaries drop detail by definition.
- It **re-carries recoverable facts** (what the code now looks like) lossily, instead of pointing at them.
- It **floats free of the plan** — nothing re-anchors the fresh session to the source of truth, so it wanders.

## 2. The wedge

This space is crowded (Task Master, Backlog.md, spec-kit, superpowers plans, Claude Code's native Tasks, MCP memory servers). Every individual capability — persistent task store, subagent execution, minimal-code writing — already ships somewhere. **We are not building another task store or another executor.**

The seam nobody owns is **capture fidelity + proactive surfacing + anti-drift handoff**:

- **One sharp opinion:** *the backlog that remembers **why**, not just **what**.*
- **Hero demo:** *fresh-session phase handoffs that don't lose the plot.* The backlog is the container; drift-proof handoff is what makes people install it.
- **Adoption formula** (learned from ponytail ~73k★ / impeccable ~43k★): one sharp opinion, universal & stack-independent pain, **automatic trigger** (greets you — not `task-master next`), near-zero setup, a trust carve-out, a quotable claim.

**Reuse, don't reinvent** (ponytail's own first rung): compose ponytail (minimal writing), the superpowers plan format (phase breakdown), and subagent execution. Our value-add is the layer none of them have: capture the irreducible context, surface it at startup, hand off without drift.

## 3. Design principles

1. **Point, don't summarize.** Anchor to ground truth (git diff = what happened; plan file = what should happen). Lossiness enters through summarization — minimize it.
2. **Capture only the irreducible delta.** Record only what a fresh session *cannot* re-read from code or plan: decisions made, constraints discovered, gotchas, deviations-and-why.
3. **Re-validate before writing.** On resume, the fresh session's first act is to check its understanding against the plan and surface mismatches *before* touching code — drift caught at the door.
4. **Lean by construction.** Each moment loads only when it fires. Ship's heavy protocol never bloats a browse-or-capture session.
5. **Deliberate execution.** Surfacing is automatic and safe; *executing* is always an explicit pick. Safety carve-out: stop for anything destructive or irreversible, and never guess on decision-level ambiguity — ask.
6. **Zero-config, in-repo, cross-tool.** No cloud, no dashboard. Plain files in the repo.

## 4. The three moments

| Moment | Trigger | Primitive | Responsibility |
|---|---|---|---|
| **Surface** | session start | **session-start hook** | Inject a compact, phase-aware summary of the backlog into a fresh session. Nothing runs. This is the auto-trigger that beats pull-based tools. |
| **Capture** | `/backlog add`, "backlog this", or `/backlog checkpoint` | **skill** (two flavors) | **Park:** harvest executable context from the live conversation for a *later* item. **Checkpoint:** produce a drift-resistant handoff at a phase boundary. |
| **Ship** | you pick an item | **skill** | Cold-start an item: reconstruct from anchors, re-validate against plan, resolve gaps, write minimally via ponytail, report, update status. May fan out subagents for the chosen item's work. |

## 5. Architecture (repo layout)

One installable plugin:

```
backlog/
├── README.md                       ← the sharp pitch + 30-second install
├── .claude-plugin/plugin.json      ← makes it one installable unit
├── hooks/
│   └── session-start.*             ← SURFACE (the auto-greeting)
├── skills/
│   ├── backlog-capture/SKILL.md    ← CAPTURE (park + checkpoint)
│   └── backlog-ship/SKILL.md       ← SHIP (cold-start resume + re-validate)
├── commands/
│   └── backlog.md                  ← /backlog entry point (list / add / checkpoint / ship)
├── scripts/
│   ├── list-items.*                ← mechanical: read + render the backlog
│   └── drift-check.*               ← mechanical: anchor SHA vs HEAD staleness
└── references/
    └── item-schema.md              ← shared parked-item format
```

Same spirit as impeccable (one repo, several coordinated pieces) — but the pieces match their triggers. **Surface is a hook, not a skill**, or the flagship feature evaporates.

## 6. Data model

**Storage:** a `.backlog/` folder inside each *consuming* project (not this plugin repo), one Markdown file per item (YAML frontmatter + body). Rich context needs room; one-file-per-item is git-diffable and lets each item carry its own material. Committable (team-shared) or gitignorable (personal) — user's choice.

**Item schema (both atomic and phased):**

```yaml
---
id: 0007
title: <one line>
status: parked | in-progress | done
intent: <what + why it matters>
decisions:            # settled choices / constraints
  - <"must use X because …">
open_questions:       # unresolved — Ship asks these, not the recoverable stuff
  - <"…">
acceptance: <done when …>
anchors:
  sha: <git SHA at capture>       # ground-truth pin for drift detection
  files: [ …relevant paths… ]
  plan: <path to plan file, if phased>   # source of truth for phases
phases:               # optional; present only for phased items
  - name: Phase 1
    status: done
    delta: <decisions/gotchas/deviations from THIS phase — the irreducible handoff>
  - name: Phase 2
    status: pending
---
<free-form notes>
```

The `delta` per phase is the heart: **not** a re-summary of the code, only what a fresh session can't recover by reading `anchors.files` + `anchors.plan`.

## 7. Key mechanisms

**Context harvesting (Capture · park).** When you park mid-conversation, pull intent, decisions, constraints, files, and open questions *out of the conversation you're already in* — so you don't retype them. Snapshot `anchors.sha`.

**Checkpoint handoff (Capture · checkpoint) — the anti-drift engine.** At a phase boundary:
- Anchor to the **git diff** since the phase's start SHA (what actually happened — ground truth, not recap).
- Anchor to the **plan file** (what the next phase should be).
- Write `delta`: only decisions/gotchas/deviations not present in code or plan.
- Advance `phases[].status`.

**Drift detection.** `drift-check` compares `anchors.sha` to `HEAD`. If anchored files changed substantially since capture, the item is flagged **stale** at Surface time ("captured 40 commits ago; anchored files have changed").

**Ship (pick → autonomous).**
1. Load `anchors.plan` (source of truth) + git state (what's done) + `delta` (decisions).
2. **Re-validate:** "Does my understanding of the next phase match the plan?" Surface any mismatch *before* writing.
3. Resolve gaps: read the codebase first; ask the user **only** the flagged `open_questions` (and any newly discovered decision-level ambiguity).
4. Implement the chosen item/phase, writing minimally via **ponytail**.
5. Report what changed; update `status`/`phases`.

## 8. Cross-tool behavior

- **Tool-agnostic:** the file store, Capture, and Surface work anywhere that reads `AGENTS.md`/skills — including **Codex**. This satisfies the original "Claude or Codex" goal.
- **Graceful degradation:** autonomous fan-out in Ship is first-class in Claude Code (subagents); in Codex it degrades to a single sequential agent. Same artifacts, less parallelism.

## 9. Safety & trust carve-outs

Mirrors ponytail's trust move — the skill is aggressive about *context*, never about *risk*:
- Stop and confirm before anything destructive or irreversible.
- Never guess on decision-level ambiguity — ask.
- Re-validate against the plan before writing; if drift is detected, surface it rather than proceed.

## 10. Reuse & honest overlaps

| We reuse | For | Instead of |
|---|---|---|
| **ponytail** | minimal-code writing during Ship | reinventing a code-quality ladder |
| **superpowers `writing-plans` format** | the phase breakdown a phased item wraps | inventing a plan format |
| **subagent execution pattern** | Ship's autonomous work | building an executor |
| md-per-item store (Backlog.md-compatible in spirit) | persistence | a cloud/DB task store |

Overlap we accept: Backlog.md/Task Master also store tasks; superpowers plans also persist phases. Our differentiation is **not** storage or planning — it is **capture fidelity + startup surfacing + anti-drift handoff**. If we can't make those meaningfully smoother than the DIY stack, the skill is redundant; that bar is the design's north star.

## 11. Acceptance scenarios (must pass)

1. **Park & cold-resume.** Park an item mid-session; in a *fresh* session, Surface lists it; picking it produces correct work without the user re-explaining intent/decisions.
2. **Phase handoff without drift (hero).** Finish Phase 1 in a long session; `checkpoint`; start a *fresh* session; Ship Phase 2 and it stays faithful to the plan — measurably better than a hand-written paste-prompt. Re-validate catches an intentionally planted drift.
3. **Staleness flagged.** Change anchored files after capture; Surface flags the item stale.
4. **Gap resolution.** An item with an `open_question` causes Ship to ask *only* that question, not re-derive recoverable context.
5. **Safety.** Ship halts before a destructive step and before acting on ambiguous decision-level intent.
6. **Cross-tool.** Capture + Surface function under Codex; Ship degrades to sequential without error.

## 12. Scope

**v1 (in):** per-project `.backlog/` store; Capture (park + checkpoint); Surface hook; Ship (single chosen item, re-validate, ponytail, gap-resolution, report); anchors (SHA + files + optional plan ref); drift flag; safety carve-outs; Claude Code first-class + Codex-compatible store/capture/surface.

**Deferred:** parallel fan-out across *multiple* items at once; global/cross-project backlog; automatic drift *repair* (v1 only flags); web/kanban UI (Backlog.md territory — don't reinvent); non-git anchoring.

## 13. Open decisions (resolve during planning)

1. **Name.** `backlog` collides with Backlog.md; a name evoking the hero (drift-proof handoff) may be more distinctive and searchable.
2. **Script language** for `list-items` / `drift-check` (shell vs node vs python) — pick for zero-dependency portability.
3. **Hook mechanics** — exact session-start injection format and how compact the Surface summary should be to avoid context cost.
4. **`AGENTS.md` integration** for the Codex path — how Capture/Surface register without a hook system.
