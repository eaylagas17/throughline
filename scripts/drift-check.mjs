import { findStore, listItems } from './lib/store.mjs';
import { computeStaleness } from './lib/drift.mjs';
import { headSha, changedFilesSince, gitRoot } from './lib/git.mjs';

const cwd = process.cwd();
const store = findStore(cwd, gitRoot(cwd));
const items = listItems(store || '');
const head = headSha(cwd);
let any = false;
for (const it of items) {
  if (!head) break;
  const { stale, reason } = computeStaleness(it, { headSha: head, changedFiles: changedFilesSince(cwd, it.anchors.sha) });
  if (stale) { any = true; process.stdout.write(`[${it.id}] ${it.title} — ${reason}\n`); }
}
if (!any) process.stdout.write('No stale items.\n');
