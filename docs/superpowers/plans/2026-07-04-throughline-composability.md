# throughline Composability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build item 0002's composability layers inside the existing throughline plugin: Layer 2 (the surface hook detects in-progress superpowers plans and lists them beside `.throughline` items) and Layer 3 plus the ponytail formalization (skill-text edits so Ship offers to delegate execution and delegates minimal-code writing), all standalone-first.

**Architecture:** One new pure library module (`scripts/lib/superpowers.mjs`, a sibling of `store.mjs`) does the detection; small additive edits wire it into the renderer, the config reader, and the surface hook. Layer 3 and ponytail are text edits to the two existing skills plus one new reference doc. No new plugin, skill, or tool. Every integration returns to today's behavior when the other skill or its plan files are absent.

**Tech Stack:** Node >= 20 (built-ins only, zero runtime dependencies), ESM (`.mjs`), Node's built-in test runner (`node --test`) with `node:assert/strict`. Markdown for skills and references.

**Source of truth:** `docs/superpowers/specs/2026-07-04-throughline-composability-design.md`.

## Global Constraints

- **Zero runtime dependencies.** Node standard library only. Tests use `node --test` + `node:assert/strict`. No new dependency may be added.
- **Standalone-first is non-negotiable.** With no superpowers plan files present, the surface output is **byte-identical** to today's. With no external skill available, Ship runs its existing inline path. No integration may error when the other side is absent.
- **Scripts read shallow / tolerant.** The new detector reads external plan files defensively (tolerate BOM, CRLF, stray whitespace), mirroring `store.mjs`. It must never throw into the hook; unreadable files are skipped.
- **Layer 2 activates only when a `.throughline/` store exists** (the surface hook already returns empty when `storeDir` is falsy). This is a deliberate, conservative boundary (do not surface plans in repos where throughline is not active). Documented as a carried-forward decision if broader behavior is later wanted.
- **`surface: off` already silences Layer 2** (it is part of surfacing). No new kill switch is added.
- **In-progress test keys on the checkbox convention, not the `### Task N` header structure**, so it survives superpowers plan-format drift.
- **Detected-plans section is capped at 5 lines** with a `+N more` tail.
- **Separator in output is the middot `·`**, consistent with `render.mjs` and `drift-check.mjs`.
- **No em dashes in contributor-facing text** (this plan, code comments, skills, references, tests). Use commas, colons, or parentheses.
- **Keep the existing 67 tests green.** Add coverage for all new code.

---

### Task 1: `detectPlans()`, the superpowers-plan detector

**Files:**
- Create: `scripts/lib/superpowers.mjs`
- Test: `test/superpowers.test.mjs`

**Interfaces:**
- Consumes: nothing (leaf module; `node:fs`, `node:path` only).
- Produces: `detectPlans(cwd, { glob }) -> Array<{ title: string, done: number, total: number, next: string, file: string }>`. Returns one entry per **in-progress** plan (has both checked and unchecked boxes). Returns `[]` when the directory is absent or no file qualifies. Also exports `DEFAULT_GLOB` (string `'docs/superpowers/plans/*.md'`).

- [ ] **Step 1: Write the failing test**

Create `test/superpowers.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectPlans, DEFAULT_GLOB } from '../scripts/lib/superpowers.mjs';

// Build a temp project with docs/superpowers/plans/<name> = <body>.
function projectWith(files, { subdir = 'docs/superpowers/plans' } = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'sp-'));
  const dir = join(cwd, subdir);
  mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return cwd;
}

const MIXED = '# Cookie migration\n\n### Task 1\n- [x] Step 1: tokens\n- [ ] **Step 2: add CSRF double-submit token**\n- [ ] Step 3: ship\n';
const DONE = '# Done plan\n- [x] a\n- [x] b\n';
const UNSTARTED = '# Unstarted plan\n- [ ] a\n- [ ] b\n';

test('mixed checkboxes → detected, with counts, title, and next', () => {
  const cwd = projectWith({ '2026-07-04-cookie.md': MIXED });
  const plans = detectPlans(cwd, {});
  assert.equal(plans.length, 1);
  assert.equal(plans[0].title, 'Cookie migration');
  assert.equal(plans[0].done, 1);
  assert.equal(plans[0].total, 3);
  assert.equal(plans[0].next, 'Step 2: add CSRF double-submit token'); // checkbox + bold stripped
  assert.match(plans[0].file, /2026-07-04-cookie\.md$/);
});

test('all checked (done) → not detected', () => {
  assert.deepEqual(detectPlans(projectWith({ 'a.md': DONE }), {}), []);
});

test('zero checked (unstarted) → not detected', () => {
  assert.deepEqual(detectPlans(projectWith({ 'a.md': UNSTARTED }), {}), []);
});

test('no plans directory → empty (standalone-first)', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'sp-'));
  assert.deepEqual(detectPlans(cwd, {}), []);
});

test('title falls back to filename when no H1', () => {
  const cwd = projectWith({ 'my-plan.md': '- [x] a\n- [ ] b\n' });
  assert.equal(detectPlans(cwd, {})[0].title, 'my-plan');
});

test('tolerates BOM and CRLF', () => {
  const cwd = projectWith({ 'a.md': '﻿# T\r\n- [x] a\r\n- [ ] b\r\n' });
  const plans = detectPlans(cwd, {});
  assert.equal(plans.length, 1);
  assert.equal(plans[0].title, 'T');
  assert.equal(plans[0].next, 'b');
});

test('multiple files are sorted by name', () => {
  const cwd = projectWith({ 'b.md': MIXED, 'a.md': MIXED });
  const files = detectPlans(cwd, {}).map(p => p.file);
  assert.ok(files[0].endsWith('a.md') && files[1].endsWith('b.md'));
});

test('glob override points at a different directory', () => {
  const cwd = projectWith({ 'a.md': MIXED }, { subdir: 'planning' });
  assert.equal(detectPlans(cwd, { glob: 'planning/*.md' }).length, 1);
  assert.equal(detectPlans(cwd, {}).length, 0); // default dir is empty
});

test('DEFAULT_GLOB is the superpowers plans path', () => {
  assert.equal(DEFAULT_GLOB, 'docs/superpowers/plans/*.md');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test test/superpowers.test.mjs`
Expected: FAIL (`Cannot find module '../scripts/lib/superpowers.mjs'`).

- [ ] **Step 3: Write the implementation**

Create `scripts/lib/superpowers.mjs`:

```js
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';

export const DEFAULT_GLOB = 'docs/superpowers/plans/*.md';

// A GitHub-flavored task-list checkbox at the start of a list item. We key on
// this convention (not on superpowers' `### Task N` headers) so detection
// survives plan-format drift. Group 1 is the box contents: ' ' or 'x'/'X'.
const CHECKBOX = /^\s*[-*+]\s+\[([ xX])\]/;

// Support a flat `<dir>/<pattern>` glob where <pattern> uses only `*` wildcards
// (for example `*.md`). This is intentionally not a full glob engine (YAGNI):
// the superpowers convention is a single flat plans directory.
function patternToRegExp(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

// Tolerant read, mirroring store.mjs: strip BOM, normalize CRLF, split to lines.
function readLines(file) {
  return readFileSync(file, 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n').split('\n');
}

function firstHeading(lines) {
  for (const line of lines) {
    const m = line.match(/^#\s+(.+?)\s*$/);
    if (m) return m[1].trim();
  }
  return '';
}

function stripMarkup(s) {
  return s.replace(/\*\*/g, '').replace(/`/g, '').trim();
}

// Parse one plan file. Returns null unless it is genuinely mid-flight
// (has BOTH checked and unchecked boxes). Zero checked = unstarted; all
// checked = done; neither should surface as "in progress".
function parsePlan(lines) {
  let checked = 0, unchecked = 0, next = '';
  for (const line of lines) {
    const m = line.match(CHECKBOX);
    if (!m) continue;
    if (m[1] === ' ') {
      unchecked++;
      if (!next) next = stripMarkup(line.replace(CHECKBOX, ''));
    } else {
      checked++;
    }
  }
  if (checked === 0 || unchecked === 0) return null;
  return { done: checked, total: checked + unchecked, next };
}

export function detectPlans(cwd, { glob = DEFAULT_GLOB } = {}) {
  const dir = join(cwd, dirname(glob));
  if (!existsSync(dir)) return [];
  const re = patternToRegExp(basename(glob));
  let names;
  try { names = readdirSync(dir).sort(); } catch { return []; }
  const plans = [];
  for (const name of names) {
    if (!re.test(name)) continue;
    const file = join(dir, name);
    try {
      const lines = readLines(file);
      const p = parsePlan(lines);
      if (p) plans.push({ title: firstHeading(lines) || basename(file, '.md'), ...p, file });
    } catch {
      // Unreadable file: skip. The hook must never crash a session.
    }
  }
  return plans;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/superpowers.test.mjs`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/superpowers.mjs test/superpowers.test.mjs
git commit -m "feat(throughline): detectPlans() finds in-progress superpowers plans (Layer 2)"
```

---

### Task 2: Render the detected-plans section

**Files:**
- Modify: `scripts/lib/render.mjs`
- Test: `test/render.test.mjs`

**Interfaces:**
- Consumes: plan objects shaped `{ title, done, total, next, file }` from Task 1.
- Produces: `renderSurface(items, plans = [])`. When `plans` is empty, output is byte-identical to the previous single-argument behavior. When `plans` is non-empty, a labeled section is appended after the items block (or shown alone if there are no items).

- [ ] **Step 1: Write the failing test**

Add to `test/render.test.mjs`:

```js
import { renderSurface as rs2 } from '../scripts/lib/render.mjs';

test('plans arg empty → byte-identical to no-plans output (standalone-first)', () => {
  const items = [{ id: '0001', title: 'X', status: 'parked', phases: [] }];
  assert.equal(rs2(items, []), rs2(items));
  assert.doesNotMatch(rs2(items, []), /📎/);
});

test('detected plans render in a labeled, subordinate section', () => {
  const items = [{ id: '0001', title: 'X', status: 'parked', phases: [] }];
  const plans = [{ title: 'Cookie migration', done: 3, total: 8, next: 'add CSRF token', file: 'p.md' }];
  const out = rs2(items, plans);
  assert.match(out, /📎 superpowers plans in progress \(not managed by throughline\):/);
  assert.match(out, /Cookie migration · 3\/8 steps · next: add CSRF token/);
  assert.match(out, /Anchor one to a throughline item/);
  assert.ok(out.indexOf('[0001]') < out.indexOf('📎')); // items first, plans below
});

test('plans-only (no throughline items) still renders the section', () => {
  const plans = [{ title: 'P', done: 1, total: 2, next: 'go', file: 'p.md' }];
  const out = rs2([], plans);
  assert.match(out, /📎 superpowers plans/);
  assert.doesNotMatch(out, /Pick one to work on/); // no items, so no pick line
});

test('plans section caps at 5 with a +N more tail', () => {
  const plans = Array.from({ length: 7 }, (_, i) => ({ title: `P${i}`, done: 1, total: 2, next: 'x', file: `${i}.md` }));
  const out = rs2([], plans);
  assert.match(out, /\+2 more/);
  assert.doesNotMatch(out, /P5/); // 6th plan (index 5) is beyond the cap
});

test('empty items and empty plans → empty string', () => {
  assert.equal(rs2([], []), '');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/render.test.mjs`
Expected: FAIL (the labeled section and cap assertions fail; `renderSurface` ignores the second argument).

- [ ] **Step 3: Write the implementation**

Replace the body of `scripts/lib/render.mjs` (keep `phaseProgress` unchanged) with:

```js
function phaseProgress(phases) {
  if (!phases || phases.length === 0) return null;
  const done = phases.filter(p => p.status === 'done').length;
  const next = phases.find(p => p.status !== 'done');
  const resume = next ? `, resume ${next.name}` : '';
  return `${done}/${phases.length} phases${resume}`;
}

const PLAN_CAP = 5;

function renderPlans(plans) {
  const lines = ['📎 superpowers plans in progress (not managed by throughline):'];
  for (const p of plans.slice(0, PLAN_CAP)) {
    const next = p.next ? ` · next: ${p.next}` : '';
    lines.push(`  ${p.title} · ${p.done}/${p.total} steps${next}`);
  }
  if (plans.length > PLAN_CAP) lines.push(`  +${plans.length - PLAN_CAP} more`);
  lines.push('  → Anchor one to a throughline item to ship it with re-validate + delta capture.');
  return lines;
}

export function renderSurface(items, plans = []) {
  const itemLines = [];
  if (items && items.length) {
    itemLines.push(`📌 throughline · ${items.length} open item${items.length > 1 ? 's' : ''} in this project:`);
    for (const it of items) {
      const prog = phaseProgress(it.phases);
      const detail = prog ? prog : it.status;
      const stale = it.stale ? `  ⚠ stale · ${it.staleReason || 'anchored files changed'}` : '';
      itemLines.push(`  [${it.id}] ${it.title} · ${detail}${stale}`);
    }
    itemLines.push('Pick one to work on: /throughline ship <id>. (Nothing runs until you pick.)');
  }
  const planLines = plans && plans.length ? renderPlans(plans) : [];
  if (!itemLines.length && !planLines.length) return '';
  if (!planLines.length) return itemLines.join('\n');
  if (!itemLines.length) return planLines.join('\n');
  return itemLines.join('\n') + '\n\n' + planLines.join('\n');
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/render.test.mjs`
Expected: PASS (new cases pass; the four pre-existing render tests still pass, confirming byte-identical behavior for the single-argument call).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/render.mjs test/render.test.mjs
git commit -m "feat(throughline): render a labeled, capped superpowers-plans section"
```

---

### Task 3: Config reader for `compose.plansGlob`

**Files:**
- Modify: `scripts/lib/config.mjs`
- Test: `test/config.test.mjs`

**Interfaces:**
- Consumes: `.throughline/config.json` in the store dir (same file `readSurfaceMode` reads).
- Produces: `readComposeGlob(storeDir) -> string`. Returns `cfg.compose.plansGlob` when it is a non-empty string, else `DEFAULT_PLANS_GLOB`. Also exports `DEFAULT_PLANS_GLOB` (`'docs/superpowers/plans/*.md'`). Tolerant: missing or malformed config returns the default, never throws.

- [ ] **Step 1: Write the failing test**

Add to `test/config.test.mjs`:

```js
import { readComposeGlob, DEFAULT_PLANS_GLOB } from '../scripts/lib/config.mjs';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function storeWithConfig(json) {
  const store = join(mkdtempSync(join(tmpdir(), 'cfg-')), '.throughline');
  mkdirSync(store, { recursive: true });
  if (json !== undefined) writeFileSync(join(store, 'config.json'), json);
  return store;
}

test('readComposeGlob: default is the superpowers plans path', () => {
  assert.equal(DEFAULT_PLANS_GLOB, 'docs/superpowers/plans/*.md');
  assert.equal(readComposeGlob(null), DEFAULT_PLANS_GLOB);
  assert.equal(readComposeGlob(storeWithConfig(undefined)), DEFAULT_PLANS_GLOB); // no config file
});

test('readComposeGlob: reads a configured glob', () => {
  const store = storeWithConfig('{"compose":{"plansGlob":"planning/*.md"}}');
  assert.equal(readComposeGlob(store), 'planning/*.md');
});

test('readComposeGlob: malformed or empty config → default', () => {
  assert.equal(readComposeGlob(storeWithConfig('not json')), DEFAULT_PLANS_GLOB);
  assert.equal(readComposeGlob(storeWithConfig('{"compose":{"plansGlob":"  "}}')), DEFAULT_PLANS_GLOB);
  assert.equal(readComposeGlob(storeWithConfig('{"surface":"auto"}')), DEFAULT_PLANS_GLOB); // key absent
});
```

(If `test/config.test.mjs` lacks the `test`/`assert` imports at the top, they are already present in the existing file; do not duplicate them.)

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/config.test.mjs`
Expected: FAIL (`readComposeGlob` is not exported).

- [ ] **Step 3: Write the implementation**

Append to `scripts/lib/config.mjs`:

```js
export const DEFAULT_PLANS_GLOB = 'docs/superpowers/plans/*.md';

// Which files Layer 2 scans for in-progress plans. Tolerant like readSurfaceMode:
// missing, malformed, or absent key all fall back to the default, never throw.
export function readComposeGlob(storeDir) {
  if (!storeDir) return DEFAULT_PLANS_GLOB;
  const file = configPath(storeDir);
  if (!existsSync(file)) return DEFAULT_PLANS_GLOB;
  try {
    const cfg = JSON.parse(readFileSync(file, 'utf8'));
    const glob = cfg && cfg.compose && cfg.compose.plansGlob;
    return (typeof glob === 'string' && glob.trim()) ? glob : DEFAULT_PLANS_GLOB;
  } catch {
    return DEFAULT_PLANS_GLOB;
  }
}
```

(`configPath`, `existsSync`, and `readFileSync` are already defined/imported in `config.mjs`.)

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/config.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/config.mjs test/config.test.mjs
git commit -m "feat(throughline): read optional compose.plansGlob from config"
```

---

### Task 4: Wire detection into the surface hook

**Files:**
- Modify: `hooks/throughline-surface.mjs`
- Test: `test/surface-hook.test.mjs`

**Interfaces:**
- Consumes: `detectPlans` (Task 1), `renderSurface(items, plans)` (Task 2), `readComposeGlob` (Task 3).
- Produces: `buildSurface` now also detects plans and passes them to `renderSurface`. `detectPlans` is an injectable option (default the real one) for testability, matching how `headSha`/`changedFilesSince` are injected. Returns empty string only when there are no items **and** no plans.

- [ ] **Step 1: Write the failing test**

Add to `test/surface-hook.test.mjs`:

```js
test('surfaces detected superpowers plans beside items (injected detector)', () => {
  const { cwd, store } = storeWith({
    '0001.md': '---\nid: 0001\ntitle: Real\nstatus: parked\nanchors:\n  sha: none\n---\n',
  });
  const out = buildSurface({
    storeDir: store, cwd,
    headSha: () => 'H', changedFilesSince: () => [],
    detectPlans: () => [{ title: 'Cookie migration', done: 3, total: 8, next: 'CSRF', file: 'p.md' }],
  });
  assert.match(out, /0001/);
  assert.match(out, /📎 superpowers plans/);
  assert.match(out, /Cookie migration/);
});

test('standalone-first: no plans → no superpowers section, items unchanged', () => {
  const { cwd, store } = storeWith({
    '0001.md': '---\nid: 0001\ntitle: Real\nstatus: parked\nanchors:\n  sha: none\n---\n',
  });
  const args = { storeDir: store, cwd, headSha: () => 'H', changedFilesSince: () => [] };
  const withDetector = buildSurface({ ...args, detectPlans: () => [] });
  assert.doesNotMatch(withDetector, /📎/);
  assert.match(withDetector, /0001/);
});

test('plans present but zero items → still surfaces (not an early empty)', () => {
  const { cwd, store } = storeWith({}); // store exists, no items
  const out = buildSurface({
    storeDir: store, cwd,
    headSha: () => 'H', changedFilesSince: () => [],
    detectPlans: () => [{ title: 'P', done: 1, total: 2, next: 'go', file: 'p.md' }],
  });
  assert.match(out, /📎 superpowers plans/);
});

test('a throwing detector never crashes the hook (defensive)', () => {
  const { cwd, store } = storeWith({
    '0001.md': '---\nid: 0001\ntitle: Real\nstatus: parked\nanchors:\n  sha: none\n---\n',
  });
  const out = buildSurface({
    storeDir: store, cwd,
    headSha: () => 'H', changedFilesSince: () => [],
    detectPlans: () => { throw new Error('boom'); },
  });
  assert.match(out, /0001/);
  assert.doesNotMatch(out, /📎/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/surface-hook.test.mjs`
Expected: FAIL (the injected `detectPlans` is ignored; no `📎` section appears; the plans-only case returns empty).

- [ ] **Step 3: Write the implementation**

In `hooks/throughline-surface.mjs`, add imports near the top:

```js
import { detectPlans as realDetectPlans } from '../scripts/lib/superpowers.mjs';
import { readComposeGlob } from '../scripts/lib/config.mjs';
```

Replace the `buildSurface` function with:

```js
export function buildSurface({ storeDir, cwd, headSha = realHeadSha, changedFilesSince = realChanged, detectPlans = realDetectPlans }) {
  if (!storeDir) return '';
  const items = listItems(storeDir);
  let plans = [];
  if (cwd) {
    try { plans = detectPlans(cwd, { glob: readComposeGlob(storeDir) }); } catch { plans = []; }
  }
  if (items.length === 0 && plans.length === 0) return '';
  const head = cwd ? headSha(cwd) : '';
  for (const it of items) {
    if (!head) continue; // non-git: skip drift, never guess
    const { stale, reason } = computeStaleness(it, { headSha: head, changedFiles: changedFilesSince(cwd, it.anchors.sha) });
    it.stale = stale; it.staleReason = reason;
  }
  return renderSurface(items, plans);
}
```

- [ ] **Step 4: Run the full suite to verify it passes**

Run: `npm test`
Expected: PASS. All pre-existing tests remain green (the `empty / missing store` test still returns empty because its store has no items and, with no `cwd`, plans are skipped), plus the four new hook cases.

- [ ] **Step 5: Commit**

```bash
git add hooks/throughline-surface.mjs test/surface-hook.test.mjs
git commit -m "feat(throughline): surface hook lists in-progress superpowers plans"
```

---

### Task 5: Layer 3 and ponytail (skill text) plus the composing reference

**Files:**
- Create: `references/composing.md`
- Modify: `skills/throughline-ship/SKILL.md` (step 6 of the Protocol)
- Modify: `skills/throughline-capture/SKILL.md` (Checkpoint step 2)

**Interfaces:** none (prose). This task adds no code and no unit test; its standalone-first property is structural (the inline branch is today's behavior). Verification is re-reading the edited files and confirming the suite stays green.

- [ ] **Step 1: Create `references/composing.md`**

```markdown
# throughline: composing with other skills

throughline is excellent standalone and merges cleanly with other installed
skills. Every integration below degrades to standalone behavior when the other
skill is absent: nothing changes and no error surfaces.

## Layer 1: anchor to a superpowers plan (already free)

A throughline item may set `anchors.plan` to any plan file, including a
`docs/superpowers/plans/*.md`. Ship loads it as the source of truth, re-validate
checks understanding against it, and drift-check compares its anchors to HEAD.
No extra wiring. throughline dogfoods this: its own core plan is a superpowers plan.

## Layer 2: detected plans at session start

The surface hook lists in-progress superpowers plans (files with both checked and
unchecked boxes) beside your `.throughline` items, in a clearly labeled section.
It is a courtesy pointer, not ownership: anchor one to a throughline item to get
re-validate plus delta capture. Configure the scan with `compose.plansGlob` in
`.throughline/config.json` (default `docs/superpowers/plans/*.md`).

## Layer 3: Ship delegates execution; checkpoint captures the delta

throughline owns the front (re-validate before writing) and the back (per-phase
delta capture); it rents the middle (execution) to the best available executor.

- **When to offer delegation:** the picked phase is substantial (maps to multiple
  plan tasks or files) and `superpowers:subagent-driven-development` is in your
  available skills. Then Ship surfaces the choice to the user rather than
  auto-delegating, because executing is always a deliberate pick.
- **On delegation:** hand the executor the plan file and only the current phase's
  tasks; stop at the phase boundary. Do not reimplement the executor.
- **Degrade:** skill absent, change is small, or the user declines: implement
  inline (today's Ship).
- **The edge the executor does not own:** its ledger records that tasks completed,
  never the why. After execution, checkpoint records the per-phase delta
  (decisions, gotchas, deviations discovered during execution).

## ponytail (minimal-code writing)

When implementing inline, if a minimal-code-writing skill (for example ponytail)
is available, invoke it to do the writing; otherwise apply the ladder yourself
(reuse, then stdlib, then native, then one-line, before new code). Delegate-when-
present, no weight gate. When execution was delegated to an executor, that skill's
review owns code quality; do not double-impose ponytail on top.
```

- [ ] **Step 2: Edit `skills/throughline-ship/SKILL.md`, Protocol step 6**

Replace the current step 6:

```markdown
6. **Implement minimally.** Compose the ponytail ladder: reuse/stdlib/native/one-line before
   writing new code. Ship the smallest change that satisfies `acceptance`.
```

with:

```markdown
6. **Implement minimally.**
   - If the picked phase is *substantial* (it maps to multiple plan tasks or files) and
     `superpowers:subagent-driven-development` is in your available skills, **surface the
     choice** to the user: delegate this phase's execution to it, or ship inline. On
     delegation, hand it the plan file and **only this phase's tasks**; let its per-task
     implementer plus reviewer loop write the code. Do not reimplement the executor.
     Re-validate (step 4) has already run, so drift is caught before any subagent writes.
   - Otherwise (the skill is absent, the change is small, or the user chose inline),
     implement inline: if a minimal-code-writing skill (for example `ponytail`) is
     available, invoke it to do the writing; otherwise apply the ladder yourself (reuse,
     then stdlib, then native, then one-line, before new code). Either way, ship the
     smallest change that satisfies `acceptance`.
   - See `${CLAUDE_PLUGIN_ROOT}/references/composing.md` for the full delegation and degrade rules.
```

- [ ] **Step 3: Edit `skills/throughline-capture/SKILL.md`, Checkpoint step 2**

After the existing Checkpoint step 2 (the `delta` instruction), add a sub-note:

```markdown
   - If this phase's execution was **delegated** to an external executor (for example
     `superpowers:subagent-driven-development`), the `delta` matters most: the executor's
     ledger records only that tasks completed, never the why. Capture what execution
     taught you that the commits and the plan do not already say.
```

- [ ] **Step 4: Verify**

- Re-read all three files; confirm no em dashes and that the delegate/degrade language is present and consistent with `references/composing.md`.
- Run: `npm test`
Expected: PASS (docs-only; no code touched, the full suite stays green). If a docs-enumerating test exists (for example `schema-doc.test.mjs`), confirm it still passes with the new reference file.

- [ ] **Step 5: Commit**

```bash
git add references/composing.md skills/throughline-ship/SKILL.md skills/throughline-capture/SKILL.md
git commit -m "docs(throughline): Ship offers delegation, checkpoint captures delegated delta (Layer 3 + ponytail)"
```

---

## Self-Review

**Spec coverage:**
- Layer 2 module, glob, mixed-checkbox test, fields, render, cap, config, wiring: Tasks 1 to 4. Covered.
- Standalone-first byte-identical guarantee: Task 2 (render level) and Task 4 (hook level, injected empty detector). Covered.
- Layer 3 delegate-or-inline, surface-the-choice, weight-scoped, phase-scoped, front/back doctrine, checkpoint delta: Task 5. Covered.
- ponytail formalization (delegate-when-present, degrade to ladder, inline-only scope): Task 5. Covered.
- Detection doctrine (no install probe, split by layer): realized by Task 4 (agent-side skills-list check is the Ship skill's runtime behavior, documented in `composing.md`) and Task 1 (file-presence only). Covered.
- `surface: off` silences Layer 2: inherited, no code needed (constraint stated). Covered.
- Layer 1 already documented in README: done in a prior session; restated in `composing.md`. Covered.

**Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to Task N". Each code step shows complete code; each test step shows real assertions. Clear.

**Type consistency:** `detectPlans(cwd, { glob })` returns `{ title, done, total, next, file }` in Task 1; consumed with those exact keys in Task 2's `renderPlans` and Task 4's tests. `readComposeGlob(storeDir)` (Task 3) is called in Task 4 with `storeDir`. `renderSurface(items, plans)` (Task 2) is called with `(items, plans)` in Task 4. `DEFAULT_GLOB` (superpowers.mjs) and `DEFAULT_PLANS_GLOB` (config.mjs) are deliberately separate exports with the same value; the detector defaults to its own, the hook passes the config value. Consistent.

**Carried forward (not blocking):** the Layer-2 activation boundary (requires a `.throughline/` store) is the conservative default; loosening it to surface plans in stores-absent repos is a future decision. The fair three-arm handoff-fidelity benchmark (spec section 13) is a separate follow-up.
