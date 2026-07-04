import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSurface, surfaceContext, buildHookOutput } from '../hooks/throughline-surface.mjs';

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

test('surfaceContext: empty summary → null (silent no-op)', () => {
  assert.equal(surfaceContext(''), null);
  assert.equal(surfaceContext(null), null);
});

test('surfaceContext: wraps the summary with a directive to show the user', () => {
  const ctx = surfaceContext('📌 throughline · 1 open item');
  assert.match(ctx, /showing them this backlog/i);   // tells Claude to relay it visibly
  assert.match(ctx, /do not begin any work until they choose/i); // preserves "nothing runs until you pick"
  assert.match(ctx, /📌 throughline · 1 open item/); // the summary is still included verbatim
});

const SUMMARY = '📌 throughline · 1 open item';

test('buildHookOutput: empty summary → null in every mode (never nag)', () => {
  for (const mode of ['auto', 'passive', 'off']) {
    assert.equal(buildHookOutput({ summary: '', mode }), null);
    assert.equal(buildHookOutput({ summary: null, mode }), null);
  }
});

test('buildHookOutput: off → null even with a backlog', () => {
  assert.equal(buildHookOutput({ summary: SUMMARY, mode: 'off' }), null);
});

test('buildHookOutput: passive → additionalContext only, nothing shown directly', () => {
  const out = buildHookOutput({ summary: SUMMARY, mode: 'passive' });
  assert.equal(out.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(out.hookSpecificOutput.additionalContext, /📌 throughline/);
  assert.equal(out.systemMessage, undefined);                         // no visible line
});

test('buildHookOutput: auto → shows the backlog to the user (systemMessage) + context', () => {
  const out = buildHookOutput({ summary: SUMMARY, mode: 'auto' });
  assert.match(out.systemMessage, /📌 throughline/);                  // user sees it directly
  assert.match(out.hookSpecificOutput.additionalContext, /📌 throughline/);
  assert.equal(out.hookSpecificOutput.initialUserMessage, undefined); // no synthetic turn
});

test('buildHookOutput: default mode is auto (surfaces visibly)', () => {
  const out = buildHookOutput({ summary: SUMMARY });
  assert.ok(out.systemMessage);
});
