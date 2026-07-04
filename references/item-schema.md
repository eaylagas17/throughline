# throughline item schema

One Markdown file per item at `.throughline/NNNN.md` in the consuming project.
Frontmatter is read by scripts (shallow fields) **and** by the agent (everything).
Scripts never parse `decisions`, `open_questions`, `acceptance`, per-phase `delta`,
or the body; those are for the agent to read directly.

**Principle:** *point, don't summarize.* Capture only what a fresh session cannot
re-read from the code or the plan file. Do not restate what the diff already shows.

```yaml
---
id: 0007                     # 4-digit, assigned by scripts/new-item.mjs
title: Add dark mode toggle  # one line
status: parked               # parked | in-progress | done
intent: "Night-shift users asked for it; must not touch the existing print stylesheet"
decisions:                   # settled choices a cold session MUST respect
  - "CSS variables only, no theme library (bundle budget)"
open_questions:              # unresolved; Ship asks ONLY these
  - "Should the toggle persist per-device or per-account?"
acceptance: "Toggle in header; persists; respects prefers-color-scheme on first load"
anchors:
  sha: abc1234               # git HEAD at capture (the drift baseline)
  files: [src/theme.css, src/App.tsx]   # where the work lives / ground truth
  plan: docs/plan.md         # source of truth for phases (if phased)
phases:                      # omit for atomic items
  - name: Phase 1 (tokens)
    status: done
    delta: |                 # the irreducible handoff for THIS phase
      Chose OKLCH tokens in theme.css; App.tsx reads --bg/--ink. Deviated from
      plan: skipped the SSR flash-guard, tracked as open_question below.
  - name: Phase 2 (toggle UI)
    status: pending
---
Free-form notes. Anything not worth structuring.
```

**Atomic item (minimum):**
```yaml
---
id: 0001
title: Fix the 404 on /pricing
status: parked
intent: "Broken since the router refactor; blocks the launch checklist"
acceptance: "/pricing renders the pricing page"
anchors:
  sha: 9f2a1c0
  files: [src/router.tsx]
---
```
