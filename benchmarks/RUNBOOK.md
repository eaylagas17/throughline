# Runbook: reproduce the handoff-fidelity benchmark

Zero dependencies. No API key, no script, no build. You need a fresh agent session (or
several) and about ten minutes.

## Steps

1. **Baseline arm.** Open a *fresh* session (empty context). Paste the full contents of
   [`scenario/prompt-baseline.md`](./scenario/prompt-baseline.md) (everything below its
   divider). Record the run's `EDITS` and `DECISIONS` block.
2. **Throughline arm.** Open another *fresh* session. Paste the full contents of
   [`scenario/prompt-throughline.md`](./scenario/prompt-throughline.md). Record its output.
3. **Repeat** each arm N times (we used N=5 per arm) to get a rate, not an anecdote. Fresh
   context every run: model output is non-deterministic, so a single run is not a result.
4. **Score** each run against [`rubric.md`](./rubric.md), reading the `EDITS` (the
   self-reported `DECISIONS` is a cross-check only). A run "drifted" if it removed the
   server's Bearer path (rubric #3).
5. **Tally** per arm: mean adherence (honored / 3, averaged) and the drift rate on #3.

## Fairness rules (keep it honest)

- Both arms get the identical code fixture and the identical task ("implement Phase 2, best
  judgment"). Only the handoff and the Ship protocol differ.
- Do not edit the prompts to lead either arm. The baseline's prose is a plausible real
  handoff, not a strawman; the throughline arm is not told "keep the Bearer path" in
  isolation, it is told to re-validate against the plan and reaches that itself.
- Report what happens, including runs that cut against the hypothesis (a baseline run that
  keeps the path, a throughline run that drifts). Those make the number credible.

## What a result looks like

See [`README.md`](./README.md) for the recorded run and its stated limitations. Your numbers
will not match exactly (non-determinism); the protocol is what reproduces, not the digits.
