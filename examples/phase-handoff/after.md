# after: the throughline checkpoint

Instead of writing a prose handoff, you `/throughline checkpoint` at the Phase 1/2
boundary. throughline anchors to the git diff (what happened) and the plan (what's next),
and writes only the delta into `.throughline/0031.md`:

```yaml
---
id: 0031
title: Migrate sessions to httpOnly cookies
status: in-progress
intent: "Move web auth off localStorage (XSS-exposed) onto an httpOnly cookie, without breaking the mobile app mid-rollout."
decisions:
  - "Dual-read during migration: the server accepts BOTH the cookie and the legacy Authorization: Bearer header. The Bearer path is retired in Phase 3, not before."
  - "CSRF: double-submit token, added in Phase 2 when the web app moves to the cookie."
open_questions: []
acceptance: "Web app authenticates purely via the httpOnly cookie with CSRF protection; mobile app still authenticates via Bearer; the server supports both until Phase 3."
anchors:
  sha: b4d9f10
  files: [src/auth/middleware.ts, src/auth/login.ts, web/src/api/client.ts]
  plan: examples/phase-handoff/plan.md
phases:
  - name: Phase 1 (server issues and reads the cookie)
    status: done
    delta: |
      Server sets the httpOnly session cookie on login and reads it in auth
      middleware. Kept the Authorization: Bearer path alive in parallel (the
      dual-read decision above): the mobile app depends on it until Phase 3.
      The leftover Bearer code is deliberate. Do NOT remove it in Phase 2.
  - name: Phase 2 (web client cleanup)
    status: pending
  - name: Phase 3 (retire the Bearer path)
    status: pending
---
Checkpointed at the Phase 1/2 boundary. The dual-read decision is the one thing a fresh
session cannot recover from the diff: the code still contains the Bearer path, and the
code alone cannot say "on purpose, keep it until Phase 3."
```

The difference from the prose prompt is the `delta` and the `plan` anchor. The delta
records *why* the Bearer code is still there; the plan states, in writing, that Phase 2
must not remove it. Together they give the fresh session something to re-validate against.
See [`README.md`](./README.md) for what Ship does with them.
