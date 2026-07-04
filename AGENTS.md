# throughline (instruction-tier)

This project uses **throughline** to remember pending work across sessions. On hosts
without plugin hooks, honor these rules manually:

- **At session start**, if a `.throughline/` folder exists, read its `NNNN.md` files and
  tell the user what's pending (id, title, phase progress). Do not start work — wait for a pick.
- **To park** an idea: create `.throughline/NNNN.md` (next free 4-digit id) following the
  format in this plugin's `references/item-schema.md`. Capture the *why*, decisions, open
  questions, acceptance, and the files it touches — harvested from the current conversation.
- **To checkpoint** a phase: set the finished phase `status: done`, write its `delta` (only the
  irreducible handoff — never a code recap), and ensure the next phase is `pending`.
- **To ship** an item: read it in full and its `plan:` anchor; re-validate your understanding
  against the plan **before** writing; resolve gaps from the codebase, asking only the item's
  open questions; implement minimally; then update the item's status.

Full-tier hosts (Claude Code, Codex) automate the session-start surfacing via a hook.
