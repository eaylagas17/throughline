# before: the note you actually leave behind

You're mid-incident. A scraper hammered `/search` overnight and you agreed, in the
thread, to add rate limiting before launch. You jot a reminder so you don't forget:

```
TODO: rate-limit the public API before launch. A scraper hit /search hard last
night. Figure out the details later.
```

Three weeks later, a fresh session. "The details" are gone. What the note lost, and
what you now re-derive (some of it wrong):

- **Which routes?** Only the public ones, you decided. The note doesn't say, so the
  fresh session rate-limits *everything*, including the internal batch job that calls
  `/search` 400 times a minute. It starts returning 429 in production.
- **A library, or not?** You'd ruled out a new dependency (bundle and audit budget).
  The note doesn't say, so the fresh session reaches for `express-rate-limit`.
- **The one real open question** (per-IP vs per-API-key) is buried under all the
  recoverable context you now have to reconstruct by hand.

The decision and the constraint were the irreplaceable parts. The note kept neither.
