# Handoff-fidelity benchmark

Does a throughline handoff actually drift less than a hand-written one? This measures it on
a fixed scenario, honestly and reproducibly, with zero dependencies.

## The result

Two runs, N=5 fresh agents per arm each (N=10 per arm pooled), same code fixture and same
task ("implement Phase 2, best judgment"). Only the handoff differs: a prose paste-prompt vs.
a throughline item that points at the plan and triggers a re-validate step.

| Arm | Mean plan-adherence | Removed the still-needed server Bearer path (the planted drift) |
|---|---|---|
| Prose paste-prompt | 0.70 | **9 of 10 runs** |
| throughline item | 1.00 | **0 of 10 runs** |

**Headline:** the prose handoff deleted the server's `Bearer` path in 9 of 10 runs, which
would break the mobile app that still authenticates with it. The throughline arm kept it in
all 10, and every run's re-validate step named the exact temptation ("it looks safe to delete
the leftover Bearer code") and refused it, citing the plan. That is acceptance scenario #2's
"re-validate catches an intentionally planted drift," observed 10 times out of 10.

The one baseline run that did not drift is worth stating plainly: it reasoned about rollout
risk on its own and kept the path, with no plan to point to. So the baseline is not rigged to
fail, a prose handoff can get it right; here it just usually did not (1 of 10). That single
exception is the honest edge of this result, not a footnote to bury.

Full per-run log: [`results.md`](./results.md). Reproduce it yourself: [`RUNBOOK.md`](./RUNBOOK.md).

## Against the real alternatives (the 4-arm run)

A prose paste-prompt is a soft baseline. A second run pits throughline against the tools you
would actually use: a plan file (also standing in for Task Master or a prose pointer to the
plan) and Claude memory. Four arms, three scenarios, N=5 per arm, same model (Haiku 4.5),
reasoning-only. Kept the must-keep constraint:

| Scenario | prose | Claude memory | plan file | throughline |
|---|:--:|:--:|:--:|:--:|
| Auth (fact in plan) | 5/5 | 5/5 | 5/5 | 5/5 |
| Feature flags (fact in plan) | 0/5 | 5/5 | 5/5 | 5/5 |
| API field (discovered, contradicts plan) | 0/5 | 5/5 | **0/5** | 5/5 |

Read it honestly:

- **When the fact is in the plan** (Auth, Feature flags), a plan file, memory, and throughline
  all hold. throughline's re-validate gate adds nothing there. Drift only appears when the
  handoff *loses* the fact (the prose arm on Feature flags).
- **When a fact is discovered mid-build and contradicts the plan** (API field), the plan file
  scores **0/5**: it faithfully deletes a field an external webhook still parses, because the
  plan says to, and breaks production. throughline holds **5/5** because its per-phase delta
  captured the discovery and overrode the stale plan. Memory holds too, when it happens to
  carry the fact.

So the drift metric does not separate throughline from anything that already holds the fact; it
only beats a handoff that lost it. throughline's defensible edges are narrower and real:

- **Over a plan file or Task Master:** it survives the plan going stale (the delta overrides it).
- **Over Claude memory:** not drift-prevention (memory ties once it has the fact), but deliberate
  structured capture (the checkpoint makes the discovery reliable), session-start surfacing
  (memory does not greet you with pending work), and a per-project, committable, team-shared store.

Caveats specific to this run: the memory arm was *given* the fact as a recalled note, so it
reflects memory's best case, not its real capture reliability. N is small (5 per cell) and the
values land binary (0 or 5). One model, reasoning-only (no files touched).

## Method

- **Scenario:** a three-phase "move sessions to httpOnly cookies" migration, resumed at the
  Phase 1/2 boundary. Phase 2's plan keeps the server's legacy `Bearer` path alive for the
  mobile app until Phase 3. The [scenario prompts](./scenario) embed the post-Phase-1 code.
- **Two arms, one variable.** The [baseline prompt](./scenario/prompt-baseline.md) is a
  prose handoff with no pointer to the plan. The [throughline prompt](./scenario/prompt-throughline.md)
  is the captured item plus the plan, and it runs the Ship protocol (re-validate against the
  plan before writing). Identical fixture, identical task otherwise.
- **Rubric:** three plan-mandated Phase 2 behaviors, each honored or not; see [`rubric.md`](./rubric.md).
  Scored from each run's stated edits. The planted drift is deleting the server Bearer path.
- **Sampling:** 5 fresh, independent agents per arm per run, two runs (10 per arm pooled).
  Variation comes only from model sampling (same prompt each time).

## Limitations (read these before quoting the number)

- **Proxy, not full sessions.** These runs are independent agents given the exact prompts,
  not full Claude Code sessions with the SessionStart hook installed against a real repo.
  They isolate the *handoff* variable; they do not exercise the surfacing hook or a live
  git-anchored diff.
- **Small N, one scenario.** N=10 per arm (two runs of 5), a single migration with a single,
  sharp planted drift. Do not read "90% vs 0%" as a universal rate. Real handoffs have fuzzier
  and multiple drift opportunities; expect a smaller, messier separation in the wild.
- **The baseline is one plausible prose handoff, not the worst or the best.** Its "delete the
  old Authorization header code" phrasing is a realistic thing a saturated session writes,
  and it is what induces the drift. A more careful hand-written handoff (one that separates
  the client header from the server path, or that pastes the plan) would drift less, but
  writing that careful handoff is exactly the manual labor throughline removes. The captured
  item's edge is that it carried the "keep it until Phase 3" decision the prose dropped.
- **Same model both arms.** This measures the effect of the throughline *method* (capture +
  re-validate) holding the model fixed. It is not a comparison across models or tools.

The honest takeaway is narrow and real: when a plan carries a decision that leftover code is
deliberate, a prose handoff that summarized that decision away drifts, and a throughline item
that pointed at the plan and re-validated did not. Re-run it with the runbook and see for
yourself; the digits will move, the direction should not.
