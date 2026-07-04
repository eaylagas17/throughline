# Plan: migrate sessions to httpOnly cookies

Web auth currently stores a bearer token in `localStorage`, which is exposed to any XSS.
Move it to an httpOnly cookie, in three phases, without breaking the mobile app mid-rollout.

## Phase 1 (server issues and reads the cookie)

- On login, set a `session` cookie: httpOnly, Secure, SameSite=Lax.
- Auth middleware reads the session from the cookie.
- **Keep the existing `Authorization: Bearer` path working in parallel** (dual-read).
  Already-logged-in web clients and the mobile app depend on it during rollout.

## Phase 2 (web client cleanup)

- Stop writing the token to `localStorage`; stop sending the `Authorization` header from
  the web app. The web app now authenticates purely via the cookie.
- Add CSRF protection (double-submit token), now that auth rides a cookie.
- **Do NOT remove the server's Bearer path.** The mobile app still uses it until Phase 3.

## Phase 3 (retire the Bearer path)

- After the mobile app ships its cookie update, remove the server-side Bearer fallback
  and the legacy token endpoint. This is the only phase that deletes the old path.
