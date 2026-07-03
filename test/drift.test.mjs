import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStaleness } from '../scripts/lib/drift.mjs';

const item = (sha, files = []) => ({ anchors: { sha, files, plan: '' } });

test('no sha → never stale', () => {
  assert.equal(computeStaleness(item('none', ['a']), { headSha: 'z', changedFiles: ['a'] }).stale, false);
  assert.equal(computeStaleness(item('', ['a']), { headSha: 'z', changedFiles: ['a'] }).stale, false);
});

test('sha equals HEAD → not stale', () => {
  assert.equal(computeStaleness(item('abc', ['a']), { headSha: 'abc', changedFiles: ['a'] }).stale, false);
});

test('anchored file changed since sha → stale', () => {
  const r = computeStaleness(item('abc', ['src/a.ts', 'src/b.ts']), { headSha: 'def', changedFiles: ['src/a.ts'] });
  assert.equal(r.stale, true);
  assert.match(r.reason, /a\.ts/);
});

test('HEAD moved but anchored files untouched → not stale', () => {
  assert.equal(computeStaleness(item('abc', ['src/a.ts']), { headSha: 'def', changedFiles: ['src/other.ts'] }).stale, false);
});
