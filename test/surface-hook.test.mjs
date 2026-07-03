import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSurface } from '../hooks/throughline-surface.mjs';

function storeWith(files) {
  const dir = mkdtempSync(join(tmpdir(), 'surf-'));
  const store = join(dir, '.throughline');
  mkdirSync(store);
  for (const [name, body] of Object.entries(files)) writeFileSync(join(store, name), body);
  return { cwd: dir, store };
}

test('empty / missing store → empty string', () => {
  assert.equal(buildSurface({ storeDir: null }), '');
  const { store } = storeWith({});
  assert.equal(buildSurface({ storeDir: store, headSha: () => '', changedFilesSince: () => [] }), '');
});

test('lists items and marks a stale one', () => {
  const { cwd, store } = storeWith({
    '0001.md': '---\nid: 0001\ntitle: Fresh\nstatus: parked\nanchors:\n  sha: abc\n  files: [a.ts]\n---\n',
    '0002.md': '---\nid: 0002\ntitle: Old\nstatus: parked\nanchors:\n  sha: old\n  files: [b.ts]\n---\n',
  });
  const out = buildSurface({
    storeDir: store, cwd,
    headSha: () => 'HEADNOW',
    changedFilesSince: (_c, sha) => (sha === 'old' ? ['b.ts'] : []),
  });
  assert.match(out, /0001/);
  assert.match(out, /0002/);
  assert.match(out, /stale/i);           // 0002 anchored file changed
  assert.doesNotMatch(out.split('Old')[0], /stale/i); // 0001 not stale
});
