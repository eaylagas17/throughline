# Phase handoff without drift (the hero)

**Scenario:** Phase 1 fills the context window, so Phase 2 has to run in a fresh session.
This is acceptance scenario #2: stay faithful to the plan, measurably better than a
hand-written paste-prompt, and let re-validate catch an intentionally planted drift.

Three files:

- [`plan.md`](./plan.md): the source of truth. Phase 2 is web-client cleanup plus CSRF;
  the server's `Authorization: Bearer` path must survive until Phase 3 for the mobile app.
- [`before.md`](./before.md): the prose paste-prompt. It says "delete the old Authorization
  header code," which contradicts the plan. A fresh session trusting it breaks mobile auth.
- [`after.md`](./after.md): the `.throughline/0031.md` checkpoint. Its `delta` records
  *why* the Bearer code is still there, and its `plan` anchor points at `plan.md`.

## What Ship does in the fresh session

`/throughline ship 0031` reconstructs from ground truth before it writes anything:

1. Reads `plan.md` (what Phase 2 must be), the diff since `sha: b4d9f10` (what Phase 1
   actually did), and the Phase 1 `delta` (the decisions behind it).
2. **Re-validates against the plan before writing.** It states its understanding of
   Phase 2 and checks it against `plan.md`:

   > Phase 2 scope per plan.md: stop sending the token from the web app, add CSRF.
   > Both plan.md and the Phase 1 delta say the server's `Authorization: Bearer` path
   > stays until Phase 3 (the mobile app needs it). I will not remove it now.
   > This matches the plan. Proceeding.

3. Implements only the Phase 2 scope. The Bearer path stays. Mobile auth keeps working.

## The planted drift, caught at the door

The drift is the prose prompt's instruction to "delete the old Authorization header code."
Feed *that* intent to Ship and re-validate rejects it, because it contradicts `plan.md`:

> Requested: remove the Authorization: Bearer path in Phase 2.
> plan.md Phase 2 says "Do NOT remove the server's Bearer path" (mobile depends on it
> until Phase 3), and the Phase 1 delta marks that code as deliberate. This is a drift
> from the plan. Stopping before writing. Did the plan change, or should this wait for
> Phase 3?

Same underlying mistake as the prose handoff. The difference is that the throughline item
carries a plan to check against and a delta that says the leftover code is intentional, so
the drift surfaces *before* a single line is written instead of after mobile auth is broken.
