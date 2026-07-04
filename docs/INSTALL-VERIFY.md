# Install & Surface Verification

Evidence that throughline surfaces the backlog at session start with **no prompt**, and
stays silent when there is nothing to show.

## Environment

- Node **v23.11.0** (plugin requires Node ≥ 20; scripts are zero-dependency ESM).
- Test suite: **41/41 passing** (`npm test`).

## SessionStart hook contract (confirmed against current Claude Code docs)

The surface hook is a `SessionStart` command hook. Confirmed authoritative behavior:

- **Injection shape** — the hook writes this to stdout to add context to a fresh session:
  ```json
  {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"<summary>"}}
  ```
- **Exit 0** is required for the output to be processed.
- **Silent no-op** — empty stdout + exit 0 injects nothing. Safe.
- **Matcher** `startup|resume|clear|compact` fires on: new session (`startup`), `--resume`/`--continue`/`/resume` (`resume`), `/clear` (`clear`), and compaction (`compact`). So opening a new session **or** running `/clear` both surface the backlog.
- **`${CLAUDE_PLUGIN_ROOT}`** resolves to the plugin's install dir; used to locate the hook script.
- The hook uses **exec form** (`"command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/hooks/throughline-surface.mjs"]`) — cross-platform (no shell syntax), works on Windows without Git Bash. (`commandWindows` is not a real field and was removed.)

## Programmatic end-to-end evidence (surface-on-fresh-session)

In a throwaway git project, after capturing one item, running the surface hook exactly as a
fresh `SessionStart` would, emits:

```json
{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"📌 throughline — 1 open item in this project:\n  [0001] Add search to the docs page — parked\nPick one to work on: /throughline ship <id>. (Nothing runs until you pick.)"}}
```

→ The backlog is surfaced automatically; **nothing executes** until an item is picked.

Covered by `test/integration.test.mjs`:
- capture → `.throughline/0001.md` created;
- surface hook emits the SessionStart JSON containing the item;
- `list-items` shows it;
- a project with **no** `.throughline/` → surface hook emits **empty** output (silent no-op).

## Install

**Claude Code** (two separate prompts):
```
/plugin marketplace add <you>/throughline
```
```
/plugin install throughline@throughline
```

**Codex:**
```
codex plugin marketplace add <you>/throughline
```
then `/plugins` → install; `/hooks` → trust the SessionStart lifecycle hook.

**Instruction-tier hosts** (Cursor, Copilot, …): copy `AGENTS.md` (+ `references/`) into the project.

## Remaining manual step (user-run — interactive)

The mechanics above are verified programmatically. The one check that requires a **live,
interactive Claude Code session** (which the build agent cannot perform or observe):

1. Install the plugin into your Claude Code (commands above).
2. In a git project, create an item: `node <plugin>/scripts/new-item.mjs "Try throughline"`.
3. Run `/clear`. **Expected:** the throughline summary appears automatically, **no prompt**; nothing executes.
4. In a project with no `.throughline/`, run `/clear`. **Expected:** no throughline output, no error.

If the live contract ever differs from the JSON shape above, only the `emit()` wrapper in
`hooks/throughline-surface.mjs` needs to change — `buildSurface` stays as-is.
