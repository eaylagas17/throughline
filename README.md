# throughline

**Keep the throughline across every session.**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Node ≥ 20](https://img.shields.io/badge/node-%E2%89%A5%2020-43853d.svg)](https://nodejs.org)
[![Zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](./package.json)
[![Claude Code · Codex](https://img.shields.io/badge/plugin-Claude%20Code%20%C2%B7%20Codex-8a5cf6.svg)](#install-in-30-seconds)

You finish Phase 1. The context window is full. So you ask the agent to write a handoff
prompt, paste it into a fresh session for Phase 2, and watch it quietly rebuild the wrong
thing. The prompt was prose, summarized from an already-degraded context, floating free of the
plan. It drifted.

**throughline** is a zero-dependency plugin for **Claude Code** and **Codex** that fixes that.
It's a per-project, anti-amnesia backlog: it **surfaces** your pending work the moment a session
starts, lets you **capture** an idea or a phase boundary without retyping it, and **ships** a
picked item from a cold start, re-validating against the plan *before* it writes a single line.

The throughline is the one thread that runs *through* every phase of a build: the thing a fresh
session must not lose. This keeps it.

---

## The problem

Pending work loses its context between sessions. Two flavors of the same pain:

1. **Parked ideas evaporate.** You'll build it "later." Later arrives in a fresh session with
   none of the *why*, the decisions already made, or the relevant files, so you re-explain it
   from scratch, badly.
2. **Phase handoffs drift (the killer).** A hand-written handoff prompt is **prose summarized
   from a saturated context window** (summaries drop detail), it **re-carries recoverable facts
   lossily** instead of pointing at them, and it **floats free of the plan** so nothing
   re-anchors the fresh session to the source of truth.

## How it works

Three moments, each wired to its natural trigger:

| Moment | Fires on | What happens |
|---|---|---|
| **Surface** | session start | A `SessionStart` hook shows your open items (phase-aware, staleness-flagged) the instant a session (or `/clear`) begins. Nothing runs; it just greets you with what's pending. |
| **Capture** | "park this" · `/throughline checkpoint` | Harvests the irreducible context out of the conversation you're *already in* (intent, decisions, open questions, the files it touches) into `.throughline/NNNN.md`. **Park** an idea for later, or **checkpoint** a phase boundary into a drift-resistant handoff. |
| **Ship** | you pick an item | Cold-starts the item: reconstructs from anchors, **re-validates against the plan before writing**, asks only the genuinely open questions, then implements minimally. |

Two ideas do the real work:

- **Point, don't summarize.** Anchor to ground truth (the git diff for what happened, the plan
  file for what should happen) instead of a lossy prose recap. Capture only the *delta* a fresh
  session can't re-read from code or plan: decisions, gotchas, deviations-and-why.
- **Re-validate before writing.** On resume, the first act is to check the plan and surface any
  mismatch *before* touching code. Drift caught at the door, not three files later.

## Before / after

A hand-written handoff leans on prose the next session has to *trust*:

```
We finished phase 1 (the auth tokens). For phase 2 add the login UI, it uses the
theme stuff we set up, and there was something about SSR we skipped. Files are in
src/. Match the existing style.
```

The fresh session guesses at "the theme stuff," silently re-adds the SSR guard you dropped on
purpose, and reinvents the styling. A throughline item **points** instead:

```yaml
anchors:
  sha: abc1234                 # ground truth: the diff since here IS what happened
  files: [src/theme.css, src/App.tsx]
  plan: docs/plan.md           # source of truth: what phase 2 must be
phases:
  - name: Phase 1 (tokens)
    status: done
    delta: |                   # the ONLY thing a fresh session can't re-read:
      Chose OKLCH tokens. Deviated from the plan by skipping the SSR flash-guard;
      tracked as an open question. Don't re-add it silently.
  - name: Phase 2 (login UI)
    status: pending
```

Ship reads the real diff and the plan, re-validates its understanding, and asks only the open
question. Nothing to re-explain. More worked before/afters live in [`examples/`](./examples).

## Does it hold up?

A reproducible, zero-dependency benchmark ([`benchmarks/`](./benchmarks)) runs the
phase-handoff scenario above through fresh agents twice: once handed the prose paste-prompt,
once handed the throughline item. Same code, same task, scored on a fixed plan-adherence
rubric, N=5 per arm:

- **Prose paste-prompt:** deleted the still-needed server auth path (the planted drift) in
  **5 of 5** runs, which would have broken the mobile app.
- **throughline item:** kept it in **5 of 5**, and every run's re-validate step named the
  temptation and refused it, citing the plan.

That is one run of a single scenario, with the method and limitations stated in full: it is
a subagent proxy rather than full sessions, N is small, and the digits will move when you
re-run it (the direction should not). The number is honest and re-runnable, not a marketing
figure. Method, rubric, and caveats live in [`benchmarks/README.md`](./benchmarks).

## Honest lineage

This space is crowded, and throughline is **not the first backlog tool**. It doesn't claim to
be. It's honest about where it sits:

- **Task Master, Backlog.md** store *tasks*.
- **superpowers** persists *phases*.
- **throughline** adds the layer they don't: **capture fidelity, startup surfacing, and
  anti-drift handoff.**

It doesn't reinvent a task store, a planner, or an executor. It *composes* what already works
(minimal-code writing, the phase-plan format, subagent execution) and adds the one seam nobody
owns. If those three aren't meaningfully smoother than the DIY stack, the plugin is redundant.
That's the bar it holds itself to.

## Install in 30 seconds

**Claude Code**

```
/plugin marketplace add eaylagas17/throughline
/plugin install throughline@throughline
```

**Codex**

```
codex plugin marketplace add eaylagas17/throughline
```

**Any other agent** (Cursor, Windsurf, Copilot, …): instruction tier, no hook. Copy
[`AGENTS.md`](./AGENTS.md) into your project's agent rules. You get Capture and Surface as
always-on conventions; autonomous Ship is a full-tier feature.

No cloud, no dashboard, no config. Items live as plain Markdown in a `.throughline/` folder in
your repo: commit them to share with your team, or gitignore them to keep them personal.

## Commands

```
/throughline                 # or "list": show the backlog
/throughline add <title>     # park an idea (captured from the current conversation)
/throughline checkpoint      # hand off the current phase to a fresh session
/throughline ship <id>       # cold-start and execute a picked item
/throughline surface <mode>  # auto | passive | off: how the backlog greets you
```

Each item is one Markdown file (`.throughline/NNNN.md`): YAML frontmatter for the structured
fields, a free-form body for the rest. Scripts read only shallow frontmatter; the agent reads
the rich context directly. See [`references/item-schema.md`](./references/item-schema.md) for
the full shape.

## FAQ

**Isn't this just another task manager?**
No. It doesn't want to be your task store. Keep Task Master, Backlog.md, or a plain plan file.
throughline adds the layer they skip: faithful capture, automatic surfacing, and a handoff that
doesn't drift.

**Do I have to commit `.throughline/`?**
Your call. Commit it to share the backlog with your team, or gitignore it to keep it personal.

**What if I'm not using git?**
It degrades gracefully: items stamp `sha: none`, drift-detection is skipped, everything else
works.

**Does it ever run anything on its own?**
Never. Surfacing at session start is automatic and read-only; *executing* is always an explicit
`/throughline ship <id>`. Nothing runs until you pick.

## Safety & trust

throughline is aggressive about *context*, never about *risk*:

- It stops and confirms before anything destructive or irreversible.
- It never guesses on a decision-level ambiguity; it asks.
- On resume it re-validates against the plan; if it detects drift, it surfaces it rather than
  plowing ahead.

## Under the hood

- **Zero runtime dependencies.** Node standard library only (Node ≥ 20). Git via `child_process`.
- **Tests:** 67 passing via `npm test` (`node --test`), nothing to install.
- **Cross-tool by construction:** the behavior lives in shared skills/scripts; each host gets a
  thin adapter, never a fork. Claude Code and Codex get the full tier (hook + skills + commands);
  instruction-tier hosts get the conventions via `AGENTS.md`.

## Design docs

- Design spec: [`docs/superpowers/specs/2026-07-03-throughline-design.md`](./docs/superpowers/specs/2026-07-03-throughline-design.md)
- Core-plugin plan: [`docs/superpowers/plans/2026-07-03-throughline-core-plugin.md`](./docs/superpowers/plans/2026-07-03-throughline-core-plugin.md)

## License

[MIT](./LICENSE) © 2026 Enrique Aylagas
