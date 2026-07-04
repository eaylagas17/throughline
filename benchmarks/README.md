# Handoff-fidelity benchmark

Does a throughline handoff actually drift less than a hand-written one? This measures it on
a fixed scenario, honestly and reproducibly, with zero dependencies.

## The result

One run, N=5 fresh agents per arm, same code fixture and same task ("implement Phase 2,
best judgment"). Only the handoff differs: a prose paste-prompt vs. a throughline item that
points at the plan and triggers a re-validate step.

| Arm | Mean plan-adherence | Removed the still-needed server Bearer path (the planted drift) |
|---|---|---|
| Prose paste-prompt | 2/3 (0.67) | **5 of 5 runs** |
| throughline item | 3/3 (1.00) | **0 of 5 runs** |

**Headline:** the prose handoff deleted the server's `Bearer` path in every run, which
would break the mobile app that still authenticates with it. The throughline arm kept it in
every run, and each run's re-validate step named the exact temptation ("it looks safe to
delete the leftover Bearer code") and refused it, citing the plan. That is acceptance
scenario #2's "re-validate catches an intentionally planted drift," observed 5 times out of 5.

Full per-run log: [`results.md`](./results.md). Reproduce it yourself: [`RUNBOOK.md`](./RUNBOOK.md).

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
- **Sampling:** 5 fresh, independent agents per arm. Variation comes only from model sampling
  (same prompt each time).

## Limitations (read these before quoting the number)

- **Proxy, not full sessions.** These runs are independent agents given the exact prompts,
  not full Claude Code sessions with the SessionStart hook installed against a real repo.
  They isolate the *handoff* variable; they do not exercise the surfacing hook or a live
  git-anchored diff.
- **Small N, one scenario.** N=5 per arm, a single migration with a single, sharp planted
  drift. Do not read "100% vs 0%" as a universal rate. Real handoffs have fuzzier and
  multiple drift opportunities; expect a smaller, messier separation in the wild.
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
