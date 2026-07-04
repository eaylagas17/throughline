# Parked idea, resumed cold

**Scenario:** you agree to build something "later," mid-conversation, then come back to
it in a fresh session weeks on. This is acceptance scenario #1 (park and cold-resume)
and #4 (Ship asks only the open question).

- [`before.md`](./before.md): the one-line TODO you'd actually leave. It keeps *what*
  and loses *why*, so the fresh session re-derives the details and gets two of them
  wrong (throttles internal traffic, adds a dependency you'd ruled out).
- [`after.md`](./after.md): the `.throughline/0042.md` item Capture harvested from the
  same conversation. The constraint ("never throttle internal") and the decision
  ("no new dependency") survive, so `ship` does the right thing and asks only the one
  question that was genuinely open.

The point is not that throughline writes more. It writes only the **delta**: the parts a
fresh session cannot re-read from the code. The recoverable stuff (which files, what the
middleware looks like) it *points* at through `anchors`, instead of summarizing it lossily.
