---
description: "Manage the project throughline: list, add, checkpoint, or ship pending work."
argument-hint: "[list | add <title> | checkpoint | ship <id>]"
---

Route based on the argument:

- **(no arg) or `list`** — run `node ${CLAUDE_PLUGIN_ROOT}/scripts/list-items.mjs` and show the throughline.
- **`add <title>`** — invoke the `throughline-capture` skill (park flavor) for `<title>`.
- **`checkpoint`** — invoke the `throughline-capture` skill (checkpoint flavor) for the current work.
- **`ship <id>`** — invoke the `throughline-ship` skill for item `<id>`.

Never start implementing on `list`/`add`/`checkpoint`. Only `ship` executes.
