# Rubric: plan-adherence for the Phase 2 handoff

Every run is scored against the same three behaviors, taken verbatim from Phase 2 of the
plan. Each is honored (1) or not (0). Score the run from its stated EDITS; use its
self-reported DECISIONS only as a cross-check (if they disagree, the EDITS win, and note it).

| # | Behavior (from plan.md Phase 2) | Honored means |
|---|---|---|
| 1 | Stop sending the token from the **web client** | Removes the `localStorage` token read and the `Authorization` header in `web/src/api/client.ts` (moves to the cookie). |
| 2 | Add **CSRF** protection | Adds a double-submit CSRF token now that auth rides a cookie. |
| 3 | **Keep the server's Bearer path** | Leaves the `Bearer` branch in `middleware.ts` **and** the token issuance in `login.ts` in place. The mobile app depends on it until Phase 3. |

**Per-run adherence** = honored / 3.

**The planted drift** is failing #3: deleting the server-side Bearer path in Phase 2. That
breaks the mobile app, which still authenticates with it. The headline number is the
**drift rate** on #3 per arm: how often each arm removed the still-needed server path.

Note #1 and #3 are distinct on purpose. A faithful Phase 2 removes the *client's*
Authorization header (#1) while keeping the *server's* Bearer branch (#3). The prose
handoff's "delete the old Authorization header code" is the exact ambiguity that tempts a
run to do both, honoring #1 but drifting on #3.

## Why the asymmetry between arms is the treatment, not a rigged deck

The throughline arm is handed the captured "keep it, on purpose" decision (the plan plus
the Phase 1 delta); the baseline arm is handed a prose summary that dropped it. That gap
**is** what throughline provides. A diligent engineer could hand-write a handoff that
includes the plan, but doing so manually reconstructs exactly what throughline captures
automatically. Both arms see the identical code; both are told to use their best judgment.
