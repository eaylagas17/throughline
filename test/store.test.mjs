import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseItem, listItems, findStore } from '../scripts/lib/store.mjs';

const SAMPLE = `---
id: 0007
title: Add dark mode toggle
status: parked
intent: Users on night shift asked for it
decisions:
  - "must use CSS vars, no theme lib"
anchors:
  sha: abc1234
  files: [src/theme.css, src/App.tsx]
  plan: docs/plan.md
phases:
  - name: Phase 1
    status: done
  - name: Phase 2
    status: pending
---
free text body, ignored by scripts
`;

test('parseItem reads shallow fields and ignores deep ones', () => {
  const it = parseItem(SAMPLE, '/x/0007.md');
  assert.equal(it.id, '0007');
  assert.equal(it.title, 'Add dark mode toggle');
  assert.equal(it.status, 'parked');
  assert.equal(it.intent, 'Users on night shift asked for it');
  assert.equal(it.anchors.sha, 'abc1234');
  assert.deepEqual(it.anchors.files, ['src/theme.css', 'src/App.tsx']);
  assert.equal(it.anchors.plan, 'docs/plan.md');
  assert.deepEqual(it.phases, [
    { name: 'Phase 1', status: 'done' },
    { name: 'Phase 2', status: 'pending' },
  ]);
  assert.equal(it.file, '/x/0007.md');
});

test('parseItem tolerates a minimal atomic item', () => {
  const it = parseItem('---\nid: 0001\ntitle: Fix typo\nstatus: parked\n---\n');
  assert.equal(it.id, '0001');
  assert.equal(it.intent, '');
  assert.deepEqual(it.phases, []);
  assert.equal(it.anchors.sha, '');
});

test('listItems reads NNNN.md, sorts by id, ignores other files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tl-'));
  const store = join(dir, '.throughline');
  mkdirSync(store);
  writeFileSync(join(store, '0002.md'), '---\nid: 0002\ntitle: B\nstatus: parked\n---\n');
  writeFileSync(join(store, '0001.md'), '---\nid: 0001\ntitle: A\nstatus: parked\n---\n');
  writeFileSync(join(store, 'README.md'), 'not an item');
  const items = listItems(store);
  assert.deepEqual(items.map(i => i.id), ['0001', '0002']);
});

test('findStore finds .throughline at startDir', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tl-'));
  mkdirSync(join(dir, '.throughline'));
  assert.equal(findStore(dir), join(dir, '.throughline'));
  assert.equal(findStore(join(tmpdir(), 'tl-nonexistent-xyz')), null);
});

test('parseItem reads phases with dashes indented under the key (regression)', () => {
  const src = `---
id: 0010
title: Indented dash phases
status: parked
phases:
  - name: Phase 1
    status: done
  - name: Phase 2
    status: pending
---
`;
  const it = parseItem(src);
  assert.deepEqual(it.phases, [
    { name: 'Phase 1', status: 'done' },
    { name: 'Phase 2', status: 'pending' },
  ]);
});

test('parseItem reads anchors.files inline (regression)', () => {
  const src = `---
id: 0011
title: Inline files
status: parked
anchors:
  files: [src/a.ts, src/b.ts]
---
`;
  const it = parseItem(src);
  assert.deepEqual(it.anchors.files, ['src/a.ts', 'src/b.ts']);
});

test('parseItem reads phases with dashes at column 0 (same indent as key)', () => {
  const src = `---
id: 0012
title: Column-0 dash phases
status: parked
phases:
- name: Phase 1
  status: done
- name: Phase 2
  status: pending
---
`;
  const it = parseItem(src);
  assert.deepEqual(it.phases, [
    { name: 'Phase 1', status: 'done' },
    { name: 'Phase 2', status: 'pending' },
  ]);
});

test('parseItem reads anchors.files as a block dash list', () => {
  const src = `---
id: 0013
title: Block files list
status: parked
anchors:
  files:
    - src/a.ts
    - src/b.ts
---
`;
  const it = parseItem(src);
  assert.deepEqual(it.anchors.files, ['src/a.ts', 'src/b.ts']);
});

test('parseItem handles column-0 phases followed by another top-level key', () => {
  const src = `---
id: 0014
title: Column-0 dash phases then more keys
status: parked
phases:
- name: Phase 1
  status: done
intent: after phases block
---
`;
  const it = parseItem(src);
  assert.deepEqual(it.phases, [{ name: 'Phase 1', status: 'done' }]);
  assert.equal(it.intent, 'after phases block');
});

import { headSha, changedFilesSince, gitRoot } from '../scripts/lib/git.mjs';

test('git helpers work in a real temp repo, degrade elsewhere', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tlgit-'));
  const g = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'pipe' });
  g('init', '-q');
  g('config', 'user.email', 't@t.t');
  g('config', 'user.name', 'T');
  writeFileSync(join(dir, 'a.txt'), '1');
  g('add', '.'); g('commit', '-qm', 'one');
  const first = headSha(dir);
  assert.match(first, /^[0-9a-f]{7,40}$/);
  writeFileSync(join(dir, 'a.txt'), '2');
  g('add', '.'); g('commit', '-qm', 'two');
  assert.deepEqual(changedFilesSince(dir, first), ['a.txt']);
  assert.ok(gitRoot(dir).endsWith(basename(dir)));

  const nogit = mkdtempSync(join(tmpdir(), 'nogit-'));
  assert.equal(headSha(nogit), '');
  assert.deepEqual(changedFilesSince(nogit, 'abc'), []);
  assert.equal(gitRoot(nogit), null);
});
