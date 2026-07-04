# before: the hand-written paste-prompt

Phase 1 ate the context window. To continue token-efficiently you ask the agent to write
a handoff prompt for Phase 2, and paste this into a fresh session:

```
Phase 1 is done, we moved auth to cookies. For phase 2, clean up the token handling:
pull the token out of localStorage on the client and delete the old Authorization
header code so we're fully on cookies. Also add CSRF. Files are under src/auth.
Match the existing style.
```

Read it against [`plan.md`](./plan.md) and the drift is already baked in:

> "delete the old Authorization header code so we're fully on cookies"

The plan says the exact opposite: the server's `Bearer` path must **stay until Phase 3**
because the mobile app still authenticates with it. But this prompt is prose, summarized
from a saturated Phase 1 session. It compressed away the *reason* the Bearer path is still
there, so it reads the leftover code as dead code to delete.

A fresh session that trusts this prompt removes the Bearer path in Phase 2 and breaks
every mobile client in production. Nothing in the prompt re-anchors it to the plan, so
nothing stops it.
