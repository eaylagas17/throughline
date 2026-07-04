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

// SessionStart additionalContext goes to Claude, not the user's view — so we must
// instruct Claude to relay it, or the "greets you" surfacing stays invisible.
export function surfaceContext(summary) {
  if (!summary) return null;
  return `The throughline plugin loaded this project's pending backlog at session start. `
    + `Open your first reply to the user by showing them this backlog verbatim, then wait `
    + `for them to pick an item — do not begin any work until they choose one.\n\n${summary}`;
}

function emit(summary) {
  const context = surfaceContext(summary);
  if (!context) return; // silent no-op: never nag
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context },
  }) + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cwd = process.cwd();
  const { findStore } = await import('../scripts/lib/store.mjs');
  const storeDir = findStore(cwd, gitRoot(cwd));
  emit(buildSurface({ storeDir, cwd }));
}
