import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const PLUGIN = resolve('.');

test('capture in a project, then surface it as a fresh session would', () => {
  const proj = mkdtempSync(join(tmpdir(), 'proj-'));
  const g = (...a) => execFileSync('git', a, { cwd: proj, stdio: 'pipe' });
  g('init', '-q'); g('config', 'user.email', 't@t.t'); g('config', 'user.name', 'T');
  writeFileSync(join(proj, 'app.js'), 'x'); g('add', '.'); g('commit', '-qm', 'init');

  // Capture (park) — run the real helper from the project cwd
  const created = execFileSync('node', [join(PLUGIN, 'scripts/new-item.mjs'), 'Add', 'search'],
    { cwd: proj, encoding: 'utf8' }).trim();
  assert.ok(existsSync(created));
  assert.match(created, /\.throughline\/0001\.md$/);

  // Surface — what a fresh SessionStart hook would emit
  const surfaced = execFileSync('node', [join(PLUGIN, 'hooks/throughline-surface.mjs')],
    { cwd: proj, encoding: 'utf8' });
  assert.match(surfaced, /additionalContext/);
  assert.match(surfaced, /0001/);
  assert.match(surfaced, /Add search/);

  // list-items CLI shows it too
  const listed = execFileSync('node', [join(PLUGIN, 'scripts/list-items.mjs')],
    { cwd: proj, encoding: 'utf8' });
  assert.match(listed, /Add search/);
});

test('no .throughline → surface emits nothing', () => {
  const empty = mkdtempSync(join(tmpdir(), 'empty-'));
  const out = execFileSync('node', [join(PLUGIN, 'hooks/throughline-surface.mjs')],
    { cwd: empty, encoding: 'utf8' });
  assert.equal(out.trim(), '');
});
