---
description: "Manage the project throughline: list, add, checkpoint, ship, or configure surfacing."
argument-hint: "[list | add <title> | checkpoint | ship <id> | surface [auto|passive|off]]"
---

Route based on the argument:

- **(no arg) or `list`** — run `node ${CLAUDE_PLUGIN_ROOT}/scripts/list-items.mjs` and show the throughline.
- **`add <title>`** — invoke the `throughline-capture` skill (park flavor) for `<title>`.
- **`checkpoint`** — invoke the `throughline-capture` skill (checkpoint flavor) for the current work.
- **`ship <id>`** — invoke the `throughline-ship` skill for item `<id>`.
- **`surface [auto|passive|off]`** — run `node ${CLAUDE_PLUGIN_ROOT}/scripts/surface-mode.mjs $ARGUMENTS` and report the result. With no mode it prints the current setting. Modes: `auto` shows the backlog to the user at session start via a visible `systemMessage` (works on both startup and `/clear`, no injected turn); `passive` loads it into context and surfaces on the user's first message; `off` stays silent at session start. Setting persists per-project in `.throughline/config.json`.

Never start implementing on `list`/`add`/`checkpoint`/`surface`. Only `ship` executes.
