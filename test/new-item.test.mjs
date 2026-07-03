import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nextId, scaffold, main } from '../scripts/new-item.mjs';
import { parseItem } from '../scripts/lib/store.mjs';

test('nextId increments the max, pads to 4', () => {
  assert.equal(nextId([]), '0001');
  assert.equal(nextId([{ id: '0001' }, { id: '0007' }]), '0008');
});

test('scaffold contains the required frontmatter keys', () => {
  const s = scaffold({ id: '0001', title: 'Add search', sha: 'abc1234' });
  assert.match(s, /^---\n/);
  assert.match(s, /id: 0001/);
  assert.match(s, /title: Add search/);
  assert.match(s, /status: parked/);
  assert.match(s, /sha: abc1234/);
  assert.match(s, /intent:/);
  assert.match(s, /open_questions:/);
});

test('main creates .throughline/NNNN.md with stamped sha', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'cap-'));
  const path = main(['Add', 'dark', 'mode'], { cwd, headSha: () => 'deadbee', gitRoot: () => null });
  assert.ok(existsSync(path));
  assert.match(path, /\.throughline\/0001\.md$/);
  const txt = readFileSync(path, 'utf8');
  assert.match(txt, /title: Add dark mode/);
  assert.match(txt, /sha: deadbee/);
});

test('main stamps sha: none when not a git repo (headSha empty)', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'cap2-'));
  const path = main(['x'], { cwd, headSha: () => '', gitRoot: () => null });
  assert.match(readFileSync(path, 'utf8'), /sha: none/);
});

test('scaffold round-trips cleanly through parseItem', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'cap3-'));
  const path = main(['Add', 'search'], { cwd, headSha: () => 'abc1234', gitRoot: () => null });
  const txt = readFileSync(path, 'utf8');
  const item = parseItem(txt, path);
  assert.equal(item.intent, '');
  assert.equal(item.anchors.plan, '');
  assert.deepEqual(item.anchors.files, []);
  assert.equal(item.anchors.sha, 'abc1234');
  assert.equal(item.status, 'parked');
  assert.deepEqual(item.phases, []);
  assert.equal(item.id, '0001');
  assert.equal(item.title, 'Add search');
});
