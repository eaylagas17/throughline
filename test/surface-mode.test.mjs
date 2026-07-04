import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main } from '../scripts/surface-mode.mjs';

const proj = () => mkdtempSync(join(tmpdir(), 'sm-'));
const noGit = () => null; // force a cwd-rooted store, no real git needed

test('surface-mode: no arg reports the current mode (default auto)', () => {
  const res = main([], { cwd: proj(), gitRoot: noGit });
  assert.equal(res.mode, 'auto');
  assert.equal(res.changed, false);
});

test('surface-mode: setting a mode persists it', () => {
  const cwd = proj();
  const set = main(['off'], { cwd, gitRoot: noGit });
  assert.equal(set.mode, 'off');
  assert.equal(set.changed, true);
  assert.equal(main([], { cwd, gitRoot: noGit }).mode, 'off');
});

test('surface-mode: mode is case-insensitive', () => {
  assert.equal(main(['PASSIVE'], { cwd: proj(), gitRoot: noGit }).mode, 'passive');
});

test('surface-mode: an unknown mode throws', () => {
  assert.throws(() => main(['sideways'], { cwd: proj(), gitRoot: noGit }), /mode/i);
});
