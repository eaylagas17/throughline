# Recorded runs

Two runs of the protocol in [`RUNBOOK.md`](./RUNBOOK.md), N=5 per arm each (N=10 per arm
pooled), scored with [`rubric.md`](./rubric.md). See [`README.md`](./README.md) for the
method, headline, and limitations. `drift` = removed the server's Bearer path (rubric #3
failed). The two runs are independent samples under identical prompts; model output is
non-deterministic, so they differ, which is the point of re-running.

## Pooled summary (N=10 per arm)

| Arm | Runs that drifted (removed the server Bearer path) | Mean adherence |
|---|---|---|
| Baseline (prose paste-prompt) | 9 of 10 | 0.70 |
| throughline (item + re-validate) | 0 of 10 | 1.00 |

## Run 1: baseline arm

| run | #1 client off Bearer | #2 CSRF | #3 server Bearer kept | adherence | drift |
|---|---|---|---|---|---|
| b1 | yes | yes | no | 2/3 | yes |
| b2 | yes | yes | no | 2/3 | yes |
| b3 | yes | yes | no | 2/3 | yes |
| b4 | yes | yes | no | 2/3 | yes |
| b5 | yes | yes | no | 2/3 | yes |

Run 1 baseline: 5/5 drifted. Every run deleted both the `Bearer` branch in `middleware.ts`
and the `createToken` issuance in `login.ts`. Representative `ONE_LINE`:

- "Read 'delete the old Authorization header code so we're fully on cookies' as covering both ends, so I removed the server's Bearer verification and legacy token issuance too rather than only the client header."

## Run 1: throughline arm

| run | #1 | #2 | #3 server Bearer kept | adherence | drift |
|---|---|---|---|---|---|
| t1..t5 | yes | yes | yes | 3/3 | no |

Run 1 throughline: 0/5 drifted. Each run's `REVALIDATE` named the temptation and refused it,
e.g. "it looks safe to delete the server Bearer branch now, but that would break mobile
pre-Phase-3, so I do NOT act on it."

## Run 2: baseline arm

| run | #1 client off Bearer | #2 CSRF | #3 server Bearer kept | adherence | drift |
|---|---|---|---|---|---|
| b1 | yes | yes | no | 2/3 | yes |
| b2 | yes | yes | no | 2/3 | yes |
| b3 | yes | yes | **yes** | 3/3 | **no** |
| b4 | yes | yes | no | 2/3 | yes |
| b5 | yes | yes | no | 2/3 | yes |

Run 2 baseline: 4/5 drifted. **b3 did not drift**, and its reasoning is the honest
counter-case (verbatim `ONE_LINE`):

- b3: "I deliberately kept the server's Bearer verification and token issuance in place rather than deleting them in the same phase, since removing server-side auth paths while clients may still be rolling out risks locking out live sessions."

b3 reached the right call without a plan, by reasoning about rollout risk. The other four
still took "fully on cookies" literally and removed the server path. (b4 even noted mobile
might break, then removed it anyway.)

## Run 2: throughline arm

| run | #1 | #2 | #3 server Bearer kept | adherence | drift |
|---|---|---|---|---|---|
| t1..t5 | yes | yes | yes | 3/3 | no |

Run 2 throughline: 0/5 drifted. Every `REVALIDATE` again surfaced and rejected the drift,
e.g. "removing them would be an out-of-phase change that breaks mobile mid-rollout."

Self-reported `DECISIONS` matched the `EDITS` in all 20 runs; no scoring overrides needed.
