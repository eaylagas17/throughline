import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { parseItem } from '../scripts/lib/store.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docPath = join(__dirname, '..', 'references', 'item-schema.md');

function extractYamlBlocks(md) {
  const blocks = [];
  const re = /```yaml\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(md))) {
    blocks.push(m[1]);
  }
  return blocks;
}

function trimToFrontmatter(block) {
  const lines = block.split('\n');
  const startIdx = lines.findIndex(l => l.trim() === '---');
  const trimmed = lines.slice(startIdx).join('\n');
  return trimmed;
}

test('references/item-schema.md FULL example round-trips through parseItem', () => {
  const md = readFileSync(docPath, 'utf8');
  const blocks = extractYamlBlocks(md);
  assert.ok(blocks.length >= 2, 'expected at least a full and an atomic example');

  const full = trimToFrontmatter(blocks[0]);
  const it = parseItem(full);

  assert.equal(it.id, '0007');
  assert.equal(it.title, 'Add dark mode toggle');
  assert.equal(it.status, 'parked');
  assert.ok(it.intent.length > 0, 'intent should be non-empty');
  assert.ok(!it.intent.includes('|'), 'intent should be the real sentence, not a stray block-scalar pipe');
  assert.equal(it.anchors.sha, 'abc1234');
  assert.deepEqual(it.anchors.files, ['src/theme.css', 'src/App.tsx']);
  assert.equal(it.anchors.plan, 'docs/plan.md');
  assert.equal(it.phases.length, 2);
  assert.equal(it.phases[0].status, 'done');
  assert.equal(it.phases[1].status, 'pending');
  assert.match(it.phases[0].name, /^Phase 1/);
  assert.match(it.phases[1].name, /^Phase 2/);
});

test('references/item-schema.md ATOMIC example round-trips through parseItem', () => {
  const md = readFileSync(docPath, 'utf8');
  const blocks = extractYamlBlocks(md);
  assert.ok(blocks.length >= 2, 'expected at least a full and an atomic example');

  const atomic = trimToFrontmatter(blocks[1]);
  const it = parseItem(atomic);

  assert.equal(it.title, 'Fix the 404 on /pricing');
  assert.equal(it.status, 'parked');
  assert.deepEqual(it.anchors.files, ['src/router.tsx']);
});
