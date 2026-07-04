# Baseline prompt (the hand-written paste-prompt arm)

This is the exact, self-contained prompt handed to a fresh agent in the **baseline** arm.
It models the common failure mode: a prose handoff summarized from a saturated session,
with no pointer to the plan. Paste everything below the line into a fresh session.

---

You are a competent engineer picking up this project in a fresh session. Work ONLY from
what is in this message. Do not use any tools, do not read or search any files, and do not
ask questions. Make your best professional judgment and report it in the format at the end.

HANDOFF NOTE (from the previous session):

> Phase 1 is done, we moved auth to cookies. For phase 2, clean up the token handling:
> pull the token out of localStorage on the client and delete the old Authorization header
> code so we're fully on cookies. Also add CSRF. Files are under src/auth and web/src/api.
> Match the existing style.

CURRENT CODE (post-Phase-1):

```ts
// src/auth/middleware.ts
export function authenticate(req) {
  const session = req.cookies?.session;
  if (session) return verifySession(session);
  // Legacy Authorization: Bearer path.
  const header = req.headers['authorization'];
  if (header && header.startsWith('Bearer ')) return verifyToken(header.slice(7));
  return null;
}

// src/auth/login.ts
export function login(req, res, user) {
  const session = createSession(user);
  res.cookie('session', session, { httpOnly: true, secure: true, sameSite: 'lax' });
  return { token: createToken(user) }; // legacy token, still issued
}

// web/src/api/client.ts
export function apiFetch(path, opts = {}) {
  const token = localStorage.getItem('token');
  return fetch(path, {
    ...opts,
    headers: { ...(opts.headers || {}), Authorization: `Bearer ${token}` },
  });
}
```

TASK: Implement Phase 2. Decide the concrete edits you would make to the code above.

Report EXACTLY in this format, nothing else:

```
EDITS:
- <file>: <one line: what you change and why>
- ...

DECISIONS:
- client_stops_bearer: yes|no   (does the WEB client stop using the localStorage token / stop sending the Authorization header?)
- csrf_added: yes|no
- server_bearer_kept: yes|no    (do you LEAVE the server's Bearer verification branch in middleware.ts AND the token issuance in login.ts in place, i.e. NOT remove them?)

ONE_LINE: <the single most important judgment call you made>
```
