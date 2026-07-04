# throughline: repo guide (for Claude / contributors)

**throughline** is a zero-dependency Claude Code / Codex plugin: a per-project
anti-amnesia backlog. It surfaces pending work at session start (a `SessionStart`
hook), lets you **capture** items (park an idea, or checkpoint a phase boundary),
and **ship** a picked item cold (re-validate against the plan before writing).
One-liner: *"Keep the throughline across every session."* Hero: drift-proof phase handoffs.

## Working in this repo
- **Tests:** `npm test` (Node ≥ 20, built-in `node --test`, zero dependencies). Keep it green.
- **No runtime dependencies.** Node standard library only.
- **Layout:** `scripts/lib/{store,render,drift,git,config}.mjs` (core), `scripts/{new-item,list-items,drift-check,surface-mode}.mjs` (CLIs), `hooks/throughline-surface.mjs` (surface hook) + `hooks/throughline-hooks.json`, `skills/throughline-{capture,ship}/SKILL.md`, `commands/throughline.md`, `AGENTS.md` (instruction-tier), `.claude-plugin/` + `.codex-plugin/` manifests, `references/item-schema.md`.
- **Surface modes:** the SessionStart hook reads `.throughline/config.json` (`{"surface":"auto|passive|off"}`, default `auto`). `auto` shows the backlog to the user via a top-level `systemMessage` (visible at session start on both startup and `/clear`, no injected turn) and sets `additionalContext` so Claude waits for a pick; `passive` sets only `additionalContext` (surfaces on the user's first message); `off` is silent. Toggle via `/throughline surface <mode>` → `scripts/surface-mode.mjs`. (An earlier `initialUserMessage` approach was dropped: Claude Code consumes it only at true worker startup, not on `/clear`.)
- **Parser rule:** `store.mjs` reads only SHALLOW frontmatter and must tolerate LLM-authored YAML (block/inline lists, column-0 dashes, inline `#` comments, block scalars, BOM/CRLF). The agent reads deep fields (`decisions`, `open_questions`, `delta`, body).
- **Runtime store:** `.throughline/NNNN.md` in the *consuming* project (per-project). This repo dogfoods itself, so its own backlog lives in `.throughline/`.

## Where context lives (source of truth)
- **Design spec:** `docs/superpowers/specs/2026-07-03-throughline-design.md`
- **Core-plugin plan (built):** `docs/superpowers/plans/2026-07-03-throughline-core-plugin.md`
- **Current backlog:** `.throughline/0001.md`. The throughline plugin surfaces this at session start.
- **Build history & decisions:** `.superpowers/sdd/progress.md` (git-ignored local ledger).

## Status
Plan A (the core plugin) is **complete and merged to `main`** (47/47 tests). **Plan B**
(adoption layer: README, handoff-fidelity benchmark, examples, LICENSE, then publish to
GitHub) is next; it's captured in `.throughline/0001.md`. Start there.
