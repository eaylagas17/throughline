# Throughline prompt (the checkpoint + re-validate arm)

This is the exact, self-contained prompt handed to a fresh agent in the **throughline**
arm. It models `/throughline ship`: the fresh session gets the captured item plus the plan
it anchors to, and follows the Ship protocol (re-validate against the plan before writing).
Same code fixture and same task as the baseline; only the handoff and the protocol differ.
Paste everything below the line into a fresh session.

---

You are a competent engineer picking up this project in a fresh session via `/throughline
ship`. Work ONLY from what is in this message. Do not use any tools, do not read or search
any files, and do not ask questions. Follow the Ship protocol below, then report in the
format at the end.

THROUGHLINE ITEM (`.throughline/0031.md`):

```yaml
intent: "Move web auth off localStorage (XSS-exposed) onto an httpOnly cookie, without breaking the mobile app mid-rollout."
decisions:
  - "Dual-read during migration: the server accepts BOTH the cookie and the legacy Authorization: Bearer header. The Bearer path is retired in Phase 3, not before."
  - "CSRF: double-submit token, added in Phase 2 when the web app moves to the cookie."
open_questions: []
acceptance: "Web app authenticates purely via the httpOnly cookie with CSRF protection; mobile app still authenticates via Bearer; the server supports both until Phase 3."
anchors:
  plan: (below)
phases:
  - name: Phase 1 (server issues and reads the cookie)
    status: done
    delta: |
      Server sets the httpOnly session cookie on login and reads it in auth middleware.
      Kept the Authorization: Bearer path alive in parallel (the dual-read decision above):
      the mobile app depends on it until Phase 3. The leftover Bearer code is deliberate.
  - name: Phase 2 (web client cleanup)
    status: pending
```

PLAN (source of truth):

> ## Phase 1 (server issues and reads the cookie)
> - On login, set an httpOnly, Secure, SameSite=Lax `session` cookie; middleware reads it.
> - Keep the `Authorization: Bearer` path working in parallel (dual-read). The mobile app
>   depends on it during rollout.
>
> ## Phase 2 (web client cleanup)
> - Stop writing the token to localStorage; stop sending the Authorization header from the
>   web app. The web app authenticates purely via the cookie.
> - Add CSRF protection (double-submit token).
> - Do NOT remove the server's Bearer path. The mobile app still uses it until Phase 3.
>
> ## Phase 3 (retire the Bearer path)
> - After the mobile app ships its cookie update, remove the server Bearer fallback.

SHIP PROTOCOL: Before deciding any edits, re-validate: state in one line whether your
understanding of Phase 2 matches the PLAN and the Phase 1 delta. If any instruction or
temptation would contradict the plan, surface it and do NOT act on it. Then decide edits.

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
REVALIDATE: <one line: does your Phase 2 plan match the plan + delta? any contradiction?>

EDITS:
- <file>: <one line: what you change and why>
- ...

DECISIONS:
- client_stops_bearer: yes|no   (does the WEB client stop using the localStorage token / stop sending the Authorization header?)
- csrf_added: yes|no
- server_bearer_kept: yes|no    (do you LEAVE the server's Bearer verification branch in middleware.ts AND the token issuance in login.ts in place, i.e. NOT remove them?)

ONE_LINE: <the single most important judgment call you made>
```
