import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readSurfaceMode, writeSurfaceMode, DEFAULT_SURFACE_MODE, SURFACE_MODES } from '../scripts/lib/config.mjs';

function emptyStore() {
  const dir = mkdtempSync(join(tmpdir(), 'cfg-'));
  const store = join(dir, '.throughline');
  mkdirSync(store);
  return store;
}

test('the default surface mode is auto', () => {
  assert.equal(DEFAULT_SURFACE_MODE, 'auto');
});

test('SURFACE_MODES lists exactly auto, passive, off', () => {
  assert.deepEqual([...SURFACE_MODES].sort(), ['auto', 'off', 'passive']);
});

test('readSurfaceMode: null store → default', () => {
  assert.equal(readSurfaceMode(null), DEFAULT_SURFACE_MODE);
});

test('readSurfaceMode: no config file → default', () => {
  assert.equal(readSurfaceMode(emptyStore()), DEFAULT_SURFACE_MODE);
});

test('readSurfaceMode: a valid mode is returned', () => {
  const store = emptyStore();
  writeFileSync(join(store, 'config.json'), JSON.stringify({ surface: 'off' }));
  assert.equal(readSurfaceMode(store), 'off');
});

test('readSurfaceMode: unknown mode → default (tolerant)', () => {
  const store = emptyStore();
  writeFileSync(join(store, 'config.json'), JSON.stringify({ surface: 'bogus' }));
  assert.equal(readSurfaceMode(store), DEFAULT_SURFACE_MODE);
});

test('readSurfaceMode: malformed JSON → default (never throws)', () => {
  const store = emptyStore();
  writeFileSync(join(store, 'config.json'), '{ not valid json');
  assert.equal(readSurfaceMode(store), DEFAULT_SURFACE_MODE);
});

test('writeSurfaceMode: round-trips and creates the store dir if missing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cfg-'));
  const store = join(dir, '.throughline'); // does not exist yet
  const file = writeSurfaceMode(store, 'passive');
  assert.ok(existsSync(file));
  assert.equal(readSurfaceMode(store), 'passive');
});

test('writeSurfaceMode: preserves other config keys', () => {
  const store = emptyStore();
  writeFileSync(join(store, 'config.json'), JSON.stringify({ surface: 'auto', keep: 42 }));
  writeSurfaceMode(store, 'off');
  const cfg = JSON.parse(readFileSync(join(store, 'config.json'), 'utf8'));
  assert.equal(cfg.surface, 'off');
  assert.equal(cfg.keep, 42);
});

test('writeSurfaceMode: rejects an invalid mode', () => {
  const store = emptyStore();
  assert.throws(() => writeSurfaceMode(store, 'nope'), /mode/i);
});
