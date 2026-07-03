import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
