import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderSurface } from '../scripts/lib/render.mjs';

test('empty list renders empty string', () => {
  assert.equal(renderSurface([]), '');
});

test('atomic item renders id, title, status', () => {
  const out = renderSurface([
    { id: '0001', title: 'Add search', status: 'parked', phases: [] },
  ]);
  assert.match(out, /throughline/i);
  assert.match(out, /0001/);
  assert.match(out, /Add search/);
  assert.match(out, /parked/);
});

test('phased item shows phase progress', () => {
  const out = renderSurface([{
    id: '0002', title: 'Auth migration', status: 'in-progress',
    phases: [
      { name: 'Phase 1', status: 'done' },
      { name: 'Phase 2', status: 'done' },
      { name: 'Phase 3', status: 'pending' },
    ],
  }]);
  assert.match(out, /2\/3/);            // 2 of 3 phases done
  assert.match(out, /Phase 3/);         // resume point
});

test('stale item shows a marker', () => {
  const out = renderSurface([{
    id: '0003', title: 'X', status: 'parked', phases: [],
    stale: true, staleReason: 'anchored files changed',
  }]);
  assert.match(out, /stale/i);
});
