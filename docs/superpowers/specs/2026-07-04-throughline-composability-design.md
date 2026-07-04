# throughline: Composability Design Spec

**Date:** 2026-07-04
**Status:** Approved for planning
**Scope:** Item 0002 (`Composability: interop with superpowers, ponytail, and other skills`). Layers 2 and 3 plus the ponytail formalization. Layer 1 (documentation) shipped this session in the README.
**Companion:** the core design spec (`docs/superpowers/specs/2026-07-03-throughline-design.md`), especially the adapter model (section 8) and the reuse table (section 10). This spec extends those; it does not restate them.

Note on style: this spec is written without em dashes, per the style decision carried from item 0001 and reaffirmed in item 0002. The older 2026-07-03 spec was intentionally left as-is.

---

## 1. Goal

throughline must stay excellent **standalone** and also merge cleanly with other installed skills so the combination is greater than either alone: great alone, greater together. throughline positions as the surfacing plus faithful-handoff plus memory layer that sits **on top of** whatever planner, executor, or code-quality skill is present, riding their reach (superpowers, ponytail) instead of competing with them. This turns an honest lineage into an honest alliance.

The composability doctrine, stated once: **throughline owns the front (re-validate before writing) and the back (per-phase delta capture); it rents the middle (execution) to the best available executor.**

## 2. Non-negotiable: standalone-first

If superpowers, ponytail, or any other skill is absent, **nothing changes and no error surfaces**. Every integration is a thin, optional, defensive adapter, never a logic fork (this mirrors throughline's existing adapter model, core spec section 8). Concretely:

- The Layer 2 detector returns an empty result when no external plan files exist, so the session-start surface output is byte-identical to today.
- Layer 3 delegation is gated on the target skill appearing in the agent's available-skills list; absent, Ship runs its existing inline path.
- The ponytail formalization degrades to the inline minimal-code ladder that Ship already describes.

Standalone-first is a property of construction, not a runtime check we hope holds. Section 12 states the guarantees; the plan asserts the important one as a regression test.

## 3. Scope and non-goals

**In scope (this item):**
- **Layer 2:** the session-start surface hook loosely detects in-progress superpowers plans and lists them beside `.throughline` items, in a clearly labeled, subordinate section.
- **Layer 3:** Ship delegates execution to `superpowers:subagent-driven-development` when the work is substantial and the skill is present, surfacing the choice rather than auto-delegating; checkpoint (Capture) records the per-phase delta the executor's ledger does not.
- **ponytail formalization:** Ship's inline implement step delegates minimal-code writing to a minimal-code skill (for example ponytail) when present, and degrades to the inline ladder when absent.

**Already done (Layer 1, this session):** the README's "Composes with superpowers" section documents that a throughline item's `plan:` anchor already works against a superpowers plan file, so Ship, re-validate, and drift-check operate against a superpowers plan with no new code. throughline dogfoods this: its own core plan is a superpowers plan.

**Explicit non-goals:**
- **No deep lifecycle hooks into superpowers execution events (the ruled-out composition depth).** superpowers emits no such events, so this would require changes to superpowers or fragile patching, and it breaks the zero-coupling ethos. Rejected in the parked item and here.
- **No install-time probe of superpowers' on-disk layout.** See section 9.
- **No new plugin, no new skill, no new tool.** Everything lands inside the existing throughline plugin as one new internal helper module, one new reference doc, and edits to existing files. See section 10.

## 4. Design principles specific to composition

1. **Thin defensive adapter, never a logic fork.** External-format reading lives in an isolated module; core `store`, `render`, and `drift` logic is edited only at additive wiring points.
2. **Reuse throughline's tolerant-parser DNA.** Any external-format reading (superpowers plan files) mirrors `store.mjs`: tolerate BOM, CRLF, and stray whitespace; never assume strict format.
3. **Depend on the most stable signal available.** The Layer 2 in-progress test keys on the GitHub-flavored checkbox convention, not on superpowers' `### Task N` header structure, so it survives superpowers renaming or restructuring its plan format.
4. **Honest moat in the UX itself.** Surfacing another tool's plan is a courtesy, not the value. throughline's defensible value is the full model (backlog, per-phase delta capture, drift, re-validate) that also works with a superpowers plan. Detected plans are labeled as unmanaged, with a one-line pointer to what throughline adds when you anchor one.

## 5. Layer 1: already-free anchoring (done)

No code. A throughline item may set `anchors.plan` to any plan file path, including `docs/superpowers/plans/*.md`. Ship (step 1 loads the plan as source of truth), re-validate (step 4 checks understanding against it), and drift-check (anchors compared to HEAD) already operate against it. Documented in the README this session. Recorded here for completeness so the spec covers all three layers.

## 6. Layer 2: surface detection of in-progress superpowers plans

### 6.1 New module

`scripts/lib/superpowers.mjs`, a sibling of `store.mjs` and `drift.mjs`. It is a library module, not a skill. It exports a pure function:

```
detectPlans(cwd, { glob, cap }) -> [{ title, done, total, next, file }]
```

It reads matching files and returns one entry per **in-progress** plan (see 6.3). No side effects; safe to call unconditionally.

### 6.2 Glob

- Default: `docs/superpowers/plans/*.md` (superpowers' documented, flat convention; where throughline's own plan lives).
- Overridable via a new optional config key `compose.plansGlob`, read through the existing `config.mjs`. Absent config uses the default.
- Non-recursive by default (`*.md`, matching the flat convention). Recursive matching is a future option if a real need appears; not built now.

### 6.3 In-progress test (the noise-guard)

Count unchecked (`- [ ]`) and checked (`- [x]` / `- [X]`) list-item checkboxes on raw lines. A plan is **in progress** if and only if **unchecked > 0 AND checked > 0**.

- Zero checked: not started. Filtered out silently (surfacing it would be noise).
- All checked: done. Filtered out silently (surfacing it as in-progress would break the "never nag" covenant, and a detected plan has no anchor SHA to stale-check).
- Mixed: genuinely mid-flight. Surfaced.

This depends only on the checkbox convention, so it is robust to superpowers plan-format drift. It is also the cheapest possible false-positive filter.

### 6.4 Fields per plan

- `title`: the first `# ` H1 heading; fallback to the filename if none.
- `done` / `total`: checked count and (checked + unchecked) count.
- `next`: the text of the first unchecked line, stripped of the `- [ ]` marker and surrounding bold markup, trimmed. Mirrors throughline's own "resume Phase N" hint.
- `file`: the plan path (for the agent to anchor against later).

The reader is defensive in the `store.mjs` style (BOM/CRLF/whitespace tolerant).

### 6.5 Render

`render.mjs` gains a separate, subordinate section appended **after** the `.throughline` items, shown only when `detectPlans` returns entries:

```
📌 throughline · 2 open items in this project:
  [0001] ... · 3/4 phases, resume Phase 4
  [0002] ... · parked

📎 superpowers plans in progress (not managed by throughline):
  Cookie-migration plan · 3/8 steps · next: add CSRF double-submit token
  → Anchor one to a throughline item to ship it with re-validate + delta capture.
```

- Capped at 5 plan lines, with a `+N more` tail when exceeded, to protect the compact "never nag" hook ethos.
- The trailing pointer line is the honest moat framing rendered into the UX: detected plans are a courtesy; the value appears when you anchor one and get the full model.
- Separator style follows existing output (middot `·`), consistent with `render.mjs` and `drift-check.mjs`.

### 6.6 Wiring

The surface hook (`hooks/throughline-surface.mjs`) calls `detectPlans(cwd, ...)` once and passes the result into `renderSurface`. This is the only change to the hook: one added call. Because Layer 2 is part of surfacing, the existing `surface: off` mode already silences it; no new kill switch.

## 7. Layer 3: Ship delegates execution, checkpoint captures the delta

Pure text edits to two skills that already exist. No code.

### 7.1 Ship step 6 becomes delegate-or-inline

Steps 1 through 5 of Ship are unchanged, which is the point: **re-validate (step 4) still runs before anything executes.** Step 6 (implement) becomes:

> **If** the picked phase is substantial (maps to multiple plan tasks or files) **and** `superpowers:subagent-driven-development` is in your available skills, **surface the choice** to the user: delegate this phase's execution to subagent-driven-development, or ship it inline. If they choose delegation, hand it the plan file and **only the tasks belonging to this phase**; let its per-task implementer plus reviewer loop do the writing. Do not reimplement the executor.
>
> **Otherwise** (skill absent, the change is small, or the user chooses inline), implement inline via the ponytail ladder (section 8), smallest change that satisfies `acceptance`. This is today's behavior, unchanged.

Constraints baked into that text:

- **Surface the choice, never auto-delegate.** Handing execution to a multi-subagent loop is a meaningful act; throughline's principle is that executing is always a deliberate pick (core spec section 3.5). Detection and weight are necessary conditions for *offering* delegation, not for performing it.
- **Weight-scoped.** A one-file phase ships inline even when subagent-driven-development is installed. No heavy machinery on light work.
- **Scoped to the current phase, not the whole plan.** subagent-driven-development normally runs a plan's tasks continuously to the end; throughline hands it only the current phase's tasks and stops at the phase boundary, preserving throughline's phase-granular handoff on top of the executor's task loop.
- **Safety carve-outs still bind.** Stop before anything destructive or irreversible; never guess on decision-level ambiguity. Delegation does not dissolve these.

### 7.2 Why this is not just "call superpowers"

throughline keeps the two ends the executor does not own:

- **Front:** Ship's re-validate checks understanding against the item's captured `decisions` and prior-phase `delta`, the why. subagent-driven-development's pre-flight review only checks the plan's internal consistency; it never holds the captured why. Drift is caught before delegation.
- **Back:** after execution, throughline's checkpoint records the per-phase `delta` (decisions, gotchas, deviations discovered during execution). The executor's ledger records only `Task N: complete (commits ..., review clean)`: completion, never the why. That delta is throughline's irreducible edge.

### 7.3 Checkpoint edit

`skills/throughline-capture/SKILL.md` gains: after a delegated execution, checkpoint explicitly harvests the delta the executor's ledger drops ("what did execution teach us that the commits and the plan do not already say?") and advances `phases[].status`.

### 7.4 Degrade path

None of superpowers present, or the user declines delegation: step 6's inline branch runs, which is today's Ship. Zero new behavior, zero error.

## 8. ponytail formalization

One paragraph edit inside the **inline branch** of Ship step 6. Today: "Compose the ponytail ladder: reuse/stdlib/native/one-line before writing new code." It becomes:

> When implementing inline, if a minimal-code-writing skill (for example `ponytail`) is available, invoke it to do the writing; otherwise apply the ladder yourself: reuse, then stdlib, then native, then one-line, before new code. Either way, ship the smallest change that satisfies `acceptance`.

- **Delegate-when-present, not weight-scoped.** ponytail is lightweight, so unlike subagent-driven-development there is no "only if substantial" gate.
- **The inline ladder is the degrade path.** It is already the current text, so absent ponytail the behavior is exactly today's. Standalone-first is free.
- **Generic, not hard-coupled.** "A minimal-code-writing skill (for example ponytail)" names ponytail as the example without wiring to it.
- **Scoped to the inline branch only.** When execution was delegated to subagent-driven-development, that skill's task-reviewer owns code quality; throughline does not double-impose ponytail on top. Clean split: delegate means the executor owns quality; inline means ponytail owns minimal writing.
- The existing safety carve-out ("ponytail shortens the solution, never the reading or the safety guards") is untouched.

## 9. Detection doctrine (resolves open question 1)

There is no reliable, cheap, host-stable way to probe whether skill X is installed on disk, and attempting it would couple throughline to another project's install layout. So detection splits by layer, each using the signal it already holds:

- **Layer 2 (Node hook):** acts on **plan files that exist**, not on whether superpowers is installed. Reading markdown needs no plugin. This is honest (pending work is pending whether or not the plugin is currently loaded) and the mixed-checkbox guard keeps it from nagging.
- **Layer 3 and ponytail (agent-run Ship):** act on the **agent's available-skills list**, which the harness surfaces to the agent at run time. Delegate if the skill is listed; degrade inline if not. Reliable and cheap.

Rejected alternatives: an on-disk install probe (fragile, couples to superpowers' layout); a mandatory config opt-in (manual, forgettable, loses the automatic-surfacing wedge).

## 10. Architecture: files touched

Approach: isolated helper module plus thin additive wiring (chosen over inlining into core, and over a second standalone hook). Everything is inside the existing throughline plugin.

| File | New or edit | Change |
|---|---|---|
| `scripts/lib/superpowers.mjs` | new | Pure `detectPlans()` helper (a library module, not a skill). |
| `scripts/lib/render.mjs` | edit | Append the labeled, capped superpowers-plans section when present. |
| `scripts/lib/config.mjs` | edit | Read optional `compose.plansGlob`. |
| `hooks/throughline-surface.mjs` | edit | One call to `detectPlans()`, result passed to render. |
| `skills/throughline-ship/SKILL.md` | edit | Delegate-or-inline step 6 (surface-the-choice, weight-scoped, phase-scoped); ponytail formalization. |
| `skills/throughline-capture/SKILL.md` | edit | Checkpoint captures the delta after a delegated execution. |
| `references/composing.md` | new | Short reference the skills point at: the Layer 1 anchor recipe plus the delegation and degrade rules. |
| `test/*` | new / edit | Coverage per section 11. |

## 11. Testing

Zero-dependency `node --test`, keeping the existing suite green and adding coverage for new code.

- **`test/superpowers.test.mjs` (new):** mixed boxes detected; all-checked not detected; zero-checked not detected; no plan files returns empty; title from H1 and filename fallback; `next` extraction and stripping; tolerant parse (BOM/CRLF/whitespace); glob override via config; 5-line cap plus `+N more`.
- **Standalone-first regression test (the important one):** with no superpowers plans present, surface output is byte-identical to the pre-change output. The guarantee is asserted, not just claimed.
- **`test/render.test.mjs` (extend):** the labeled section renders only when plans exist, with correct formatting and cap.
- **Surface-hook test (extend):** the hook wires `detectPlans()` in; with no plan files, output is unchanged.
- **Layer 3 and ponytail** are SKILL.md prose, verified by reading. Their standalone-first is structural (the inline branch is today's behavior), not something a unit test can meaningfully assert; the plan states this honestly rather than fabricating a test around it.

## 12. Standalone-first guarantees (consolidated)

1. `detectPlans()` returns empty with no matching files, so render appends nothing and the surface is byte-identical to today. Asserted by regression test.
2. `surface: off` silences Layer 2 along with all surfacing; no new kill switch, no new failure mode.
3. Ship's delegation is gated on the skill being in the available-skills list and on the user's explicit choice; absent either, the inline path (today's Ship) runs.
4. ponytail formalization degrades to the inline ladder Ship already describes.
5. The one new config key is optional; absent config uses defaults.

## 13. Open decisions

**Resolved (all four from item 0002):**
1. Detection, delegate vs degrade: section 9 (split by layer, no install probe).
2. Layer 2 glob, fields, format-drift tolerance: section 6 (config-overridable glob; checkbox-based in-progress test independent of header structure).
3. Surface UX: section 6.5 (separate, clearly labeled, subordinate section with a moat-honest pointer; capped).
4. Ship's ponytail line sufficiency: section 8 (not sufficient; explicit delegate-when-present with a degrade path).

**Carried forward, not blocking this build:**
- A fair three-arm handoff-fidelity benchmark (prose, plan-only, plan-plus-delta) on a scenario where the drift-causing fact is discovered mid-phase (absent from the up-front plan). This is what would isolate and validate Layer 3's delta-capture value, since the current benchmark's throughline arm already carries the plan a superpowers session would also have. Consider building it alongside or after this item.

## 14. Acceptance

Maps to item 0002's acceptance:

- throughline works fully standalone with zero other skills installed: no errors, no behavior change (sections 2, 12).
- When superpowers is present: in-progress plans surface at session start (Layer 2); an item can anchor to a superpowers plan, ship (offering delegation of execution), and checkpoint deltas (Layers 1 and 3).
- When ponytail is present: Ship's inline path delegates minimal-code writing to it (section 8).
- Every integration degrades to standalone behavior when the other skill is absent (section 12).
- The README states the honest add-on positioning (Layer 1, done this session).
