import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = p => JSON.parse(readFileSync(p, 'utf8'));

test('plugin.json points at real hooks', () => {
  const p = read('.claude-plugin/plugin.json');
  assert.equal(p.name, 'throughline');
  assert.ok(existsSync(p.hooks.replace('./', '')));
});

test('marketplace.json is installable', () => {
  const m = read('.claude-plugin/marketplace.json');
  assert.equal(m.name, 'throughline');
  assert.equal(m.plugins[0].source, './');
});

test('hooks matcher covers startup|resume|clear|compact', () => {
  const h = read('hooks/throughline-hooks.json');
  const start = h.hooks.SessionStart[0];
  assert.equal(start.matcher, 'startup|resume|clear|compact');
  assert.equal(start.hooks[0].command, 'node');
  assert.match(start.hooks[0].args.join(' '), /throughline-surface\.mjs/);
  assert.match(start.hooks[0].args.join(' '), /\$\{CLAUDE_PLUGIN_ROOT\}/);
});

test('capture SKILL.md has frontmatter name + description and references the schema', () => {
  const s = readFileSync('skills/throughline-capture/SKILL.md', 'utf8');
  assert.match(s, /^---\nname: throughline-capture\n/);
  assert.match(s, /description:/);
  assert.match(s, /new-item\.mjs/);
  assert.match(s, /item-schema\.md/);
  assert.match(s, /checkpoint/i);
});
