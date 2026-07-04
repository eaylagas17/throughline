import { pathToFileURL } from 'node:url';
import { listItems } from '../scripts/lib/store.mjs';
import { renderSurface } from '../scripts/lib/render.mjs';
import { computeStaleness } from '../scripts/lib/drift.mjs';
import { headSha as realHeadSha, changedFilesSince as realChanged, gitRoot } from '../scripts/lib/git.mjs';

export function buildSurface({ storeDir, cwd, headSha = realHeadSha, changedFilesSince = realChanged }) {
  if (!storeDir) return '';
  const items = listItems(storeDir);
  if (items.length === 0) return '';
  const head = cwd ? headSha(cwd) : '';
  for (const it of items) {
    if (!head) continue; // non-git: skip drift, never guess
    const { stale, reason } = computeStaleness(it, { headSha: head, changedFiles: changedFilesSince(cwd, it.anchors.sha) });
    it.stale = stale; it.staleReason = reason;
  }
  return renderSurface(items);
}

// The context handed to Claude. `shown: true` means the backlog was already
// surfaced to the user (via systemMessage), so Claude just waits for a pick;
// otherwise Claude must relay it, since additionalContext alone is invisible.
export function surfaceContext(summary, { shown = false } = {}) {
  if (!summary) return null;
  if (shown) {
    return `throughline surfaced this project's pending backlog to the user at session start `
      + `(shown to them directly). Wait for them to pick an item with /throughline ship <id> — `
      + `do not begin any work until they choose one.\n\n${summary}`;
  }
  return `The throughline plugin loaded this project's pending backlog at session start. `
    + `Open your first reply to the user by showing them this backlog verbatim, then wait `
    + `for them to pick an item — do not begin any work until they choose one.\n\n${summary}`;
}

// Assemble the SessionStart hook payload for a given surface mode. Returns null
// (emit nothing) when there is no backlog, or when the user turned surfacing off.
//
//   auto    — top-level `systemMessage` renders the backlog straight to the user
//             (works on startup AND /clear, no synthetic turn); additionalContext
//             tells Claude it was already shown, so it just waits for a pick.
//   passive — additionalContext only: nothing shown directly; Claude relays it on
//             the user's first message.
//   off      — nothing.
export function buildHookOutput({ summary, mode = 'auto' }) {
  if (!summary || mode === 'off') return null; // silent no-op: never nag
  if (mode === 'passive') {
    return {
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: surfaceContext(summary, { shown: false }),
      },
    };
  }
  return {
    systemMessage: summary, // visible to the user at session start, no relay needed
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: surfaceContext(summary, { shown: true }),
    },
  };
}

function emit(summary, mode) {
  const output = buildHookOutput({ summary, mode });
  if (!output) return;
  process.stdout.write(JSON.stringify(output) + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cwd = process.cwd();
  const { findStore } = await import('../scripts/lib/store.mjs');
  const { readSurfaceMode } = await import('../scripts/lib/config.mjs');
  const storeDir = findStore(cwd, gitRoot(cwd));
  emit(buildSurface({ storeDir, cwd }), readSurfaceMode(storeDir));
}
