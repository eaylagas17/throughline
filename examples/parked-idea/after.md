# after: what throughline captured instead

Same moment, but you said "park this." Capture harvested the context out of the
conversation you were already in (no retyping) into `.throughline/0042.md`:

```yaml
---
id: 0042
title: Rate-limit the public API
status: parked
intent: "A scraper hit /search overnight (12k req/min). Add rate limiting before the public launch. Internal service-to-service traffic must never be throttled."
decisions:
  - "Token-bucket in the existing Express middleware; no new dependency (bundle + audit budget)."
  - "Limit only the public /search and /catalog routes. Internal callers carry the service JWT and stay exempt."
open_questions:
  - "Bucket key: per client IP, or per API key? IP is simpler but collapses clients behind shared NAT."
acceptance: "Public /search and /catalog return 429 past the limit; internal service-JWT traffic is never throttled; no new npm dependency."
anchors:
  sha: 7c1e9a2
  files: [src/middleware/index.ts, src/routes/search.ts]
---
Parked mid-incident. The scraper number, the "never throttle internal" constraint,
and the no-new-dependency call are the parts the code can't tell a later session.
```

Weeks later, `/throughline ship 0042` in a fresh session:

1. Reads the two anchor files, sees the middleware layer, and writes the token-bucket
   there. No new dependency, because the decision said so.
2. Scopes the limit to `/search` and `/catalog` and leaves service-JWT callers exempt,
   because the constraint said so. The internal batch job never sees a 429.
3. Asks you **only** the one open question: per-IP or per-API-key. Nothing else, because
   nothing else was actually unresolved.

You re-explained nothing. The two things a fresh session could not have recovered from
the code, the constraint and the no-dependency decision, are exactly the two things it
kept.
