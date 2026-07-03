# throughline — Core Plugin Implementation Plan (Plan A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the installable `throughline` plugin — a per-project anti-amnesia backlog that surfaces itself at session start and hands phased work to fresh sessions without drift.

**Architecture:** One Claude-Code/Codex plugin. A **session-start hook** injects a compact summary of the project's `.throughline/` items into every fresh session (the auto-greeting). Two **skills** — Capture (park/checkpoint) and Ship (cold-start resume) — carry the instructions. A handful of **zero-dependency Node scripts** do the mechanical work (allocate item ids, stamp git anchors, render the summary, compute drift). Division of labor: **scripts read only shallow frontmatter; the agent reads the rich item body natively.**

**Tech Stack:** Node ≥ 20 (built-ins only — no runtime dependencies), ESM (`.mjs`), Node's built-in test runner (`node --test`) with `node:assert/strict`. Git via `child_process`. Markdown + YAML-ish frontmatter for item files and manifests.

## Global Constraints

- **Name is `throughline`; command is `/throughline`; runtime store is `.throughline/`** inside each *consuming* project (never this plugin repo).
- **Zero runtime dependencies.** Node standard library only. Tests use `node --test` + `node:assert/strict`. `package.json` sets `"type": "module"` and `"engines": { "node": ">=20" }`.
- **Scripts read SHALLOW frontmatter only** (id, title, status, intent, anchors.sha, anchors.files, anchors.plan, phases[].name/status). Deep fields (`decisions`, `open_questions`, per-phase `delta`, body) are read by the *agent*, never parsed by scripts. ("Point, don't summarize.")
- **The surface hook matcher MUST be `startup|resume|clear|compact`.** It fires on new session, resume, `/clear`, and compaction.
- **Graceful no-op, never nag, never error:** the hook shell command is guarded so a missing `node` is a silent no-op; the hook script prints nothing when there is no `.throughline/` or zero items.
- **Anchors are git-based** (SHA + changed files). Non-git projects degrade: capture stamps `sha: none`, drift is skipped. (Non-git anchoring is deferred.)
- **Item files are named `NNNN.md`** (4-digit zero-padded id). The store ignores any other filename.
- **File extension is `.mjs`** for all scripts/hooks (unambiguous ESM). The spec's illustrative `.js` is superseded by this constraint.

## File Structure

```
throughline/
├── package.json                          # type:module, engines, test script — no deps
├── .gitignore
├── .claude-plugin/
│   ├── plugin.json                       # name, version, hooks + skills pointers
│   └── marketplace.json                  # enables /plugin marketplace add
├── .codex-plugin/
│   └── plugin.json                       # Codex full-tier adapter (points at same hooks/skills)
├── AGENTS.md                             # instruction-tier fallback (Cursor/Copilot/etc.)
├── hooks/
│   ├── throughline-hooks.json            # SessionStart(matcher) → surface script
│   └── throughline-surface.mjs           # SURFACE entry: read store, print additionalContext or nothing
├── scripts/
│   ├── lib/
│   │   ├── store.mjs                      # findStore, parseItem, listItems
│   │   ├── render.mjs                     # renderSurface
│   │   ├── drift.mjs                      # computeStaleness (pure)
│   │   └── git.mjs                        # headSha, changedFilesSince (best-effort)
│   ├── new-item.mjs                       # CAPTURE helper: scaffold .throughline/NNNN.md
│   ├── list-items.mjs                     # print the throughline (human)
│   └── drift-check.mjs                    # print stale items
├── skills/
│   ├── throughline-capture/SKILL.md      # CAPTURE (park + checkpoint)
│   └── throughline-ship/SKILL.md         # SHIP (cold-start resume + re-validate)
├── commands/
│   └── throughline.md                    # /throughline entry (list/add/checkpoint/ship)
├── references/
│   └── item-schema.md                    # the parked-item format (agent + human reference)
└── test/
    ├── store.test.mjs
    ├── render.test.mjs
    ├── drift.test.mjs
    ├── new-item.test.mjs
    ├── surface-hook.test.mjs
    └── manifests.test.mjs
```

**Interfaces used across tasks (defined once, referenced everywhere):**

```
// Parsed item (shallow) — produced by store.parseItem / store.listItems
Item = {
  id: string,            // "0007"
  title: string,
  status: string,        // "parked" | "in-progress" | "done"
  intent: string,        // may be ""
  anchors: { sha: string, files: string[], plan: string },  // sha "" or "none" allowed
  phases: { name: string, status: string }[],               // [] if atomic
  file: string,          // absolute path to the .md
  stale?: boolean,       // set by the surface hook after drift
  staleReason?: string,
}
```

---

### Task 1: Repo tooling (package.json, gitignore, test harness)

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `test/smoke.test.mjs` (temporary sanity test, removed in Task 2)

**Interfaces:**
- Consumes: nothing.
- Produces: `npm test` runs `node --test test/`.

- [ ] **Step 1: Write the failing test**

`test/smoke.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('test harness runs', () => {
  assert.equal(1 + 1, 2);
});
```

- [ ] **Step 2: Run it to verify the harness works**

Run: `node --test test/`
Expected: 1 test passing. (If `node --test` errors, Node is < 18 — install Node ≥ 20.)

- [ ] **Step 3: Write `package.json` and `.gitignore`**

`package.json`:
```json
{
  "name": "throughline",
  "version": "0.1.0",
  "description": "Keep the throughline across every session. An anti-amnesia backlog that surfaces at session start and hands phased work to fresh sessions without drift.",
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": { "test": "node --test test/" },
  "license": "MIT",
  "author": "Enrique Aylagas"
}
```

`.gitignore`:
```
node_modules/
*.log
.DS_Store
```

- [ ] **Step 4: Run the test via npm**

Run: `npm test`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add package.json .gitignore test/smoke.test.mjs
git commit -m "chore: node test harness, zero-dependency package"
```

---

### Task 2: Item store — parse shallow frontmatter & list items

**Files:**
- Create: `scripts/lib/store.mjs`
- Test: `test/store.test.mjs`
- Delete: `test/smoke.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `parseItem(text: string, file?: string) → Item` — parses frontmatter between the first two `---` fences; tolerant of unknown/deep fields; returns the `Item` shape above.
  - `listItems(storeDir: string) → Item[]` — reads `NNNN.md` files, parsed, sorted ascending by id.
  - `findStore(startDir: string, gitRoot?: string) → string | null` — returns the `.throughline` dir path if it exists at `startDir` or `gitRoot`, else null.

- [ ] **Step 1: Write the failing test**

`test/store.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseItem, listItems, findStore } from '../scripts/lib/store.mjs';

const SAMPLE = `---
id: 0007
title: Add dark mode toggle
status: parked
intent: Users on night shift asked for it
decisions:
  - "must use CSS vars, no theme lib"
anchors:
  sha: abc1234
  files: [src/theme.css, src/App.tsx]
  plan: docs/plan.md
phases:
  - name: Phase 1
    status: done
  - name: Phase 2
    status: pending
---
free text body, ignored by scripts
`;

test('parseItem reads shallow fields and ignores deep ones', () => {
  const it = parseItem(SAMPLE, '/x/0007.md');
  assert.equal(it.id, '0007');
  assert.equal(it.title, 'Add dark mode toggle');
  assert.equal(it.status, 'parked');
  assert.equal(it.intent, 'Users on night shift asked for it');
  assert.equal(it.anchors.sha, 'abc1234');
  assert.deepEqual(it.anchors.files, ['src/theme.css', 'src/App.tsx']);
  assert.equal(it.anchors.plan, 'docs/plan.md');
  assert.deepEqual(it.phases, [
    { name: 'Phase 1', status: 'done' },
    { name: 'Phase 2', status: 'pending' },
  ]);
  assert.equal(it.file, '/x/0007.md');
});

test('parseItem tolerates a minimal atomic item', () => {
  const it = parseItem('---\nid: 0001\ntitle: Fix typo\nstatus: parked\n---\n');
  assert.equal(it.id, '0001');
  assert.equal(it.intent, '');
  assert.deepEqual(it.phases, []);
  assert.equal(it.anchors.sha, '');
});

test('listItems reads NNNN.md, sorts by id, ignores other files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tl-'));
  const store = join(dir, '.throughline');
  mkdirSync(store);
  writeFileSync(join(store, '0002.md'), '---\nid: 0002\ntitle: B\nstatus: parked\n---\n');
  writeFileSync(join(store, '0001.md'), '---\nid: 0001\ntitle: A\nstatus: parked\n---\n');
  writeFileSync(join(store, 'README.md'), 'not an item');
  const items = listItems(store);
  assert.deepEqual(items.map(i => i.id), ['0001', '0002']);
});

test('findStore finds .throughline at startDir', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tl-'));
  mkdirSync(join(dir, '.throughline'));
  assert.equal(findStore(dir), join(dir, '.throughline'));
  assert.equal(findStore(join(tmpdir(), 'tl-nonexistent-xyz')), null);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/store.test.mjs`
Expected: FAIL — `Cannot find module '../scripts/lib/store.mjs'`.

- [ ] **Step 3: Write the implementation**

`scripts/lib/store.mjs`:
```js
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ITEM_RE = /^\d{4}\.md$/;

function stripQuotes(s) {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

function parseInlineList(s) {
  const t = s.trim();
  if (!t.startsWith('[') || !t.endsWith(']')) return null;
  const inner = t.slice(1, -1).trim();
  if (!inner) return [];
  return inner.split(',').map(x => stripQuotes(x));
}

// Minimal, tolerant frontmatter reader for the SHALLOW fields only.
export function parseItem(text, file = '') {
  const item = {
    id: '', title: '', status: '', intent: '',
    anchors: { sha: '', files: [], plan: '' },
    phases: [], file,
  };
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return item;
  const lines = m[1].split('\n');
  let ctx = null; // 'anchors' | 'phases' | null
  for (const line of lines) {
    if (!line.trim()) continue;
    const indent = line.length - line.trimStart().length;

    if (indent === 0) {
      ctx = null;
      const kv = line.match(/^([A-Za-z_]+):\s*(.*)$/);
      if (!kv) continue;
      const [, key, rawVal] = kv;
      const val = rawVal.trim();
      if (key === 'anchors' && val === '') { ctx = 'anchors'; continue; }
      if (key === 'phases' && val === '') { ctx = 'phases'; continue; }
      if (key === 'id') item.id = stripQuotes(val);
      else if (key === 'title') item.title = stripQuotes(val);
      else if (key === 'status') item.status = stripQuotes(val);
      else if (key === 'intent') item.intent = stripQuotes(val);
      // unknown top-level keys (decisions, open_questions, acceptance, ...) ignored
      continue;
    }

    if (ctx === 'anchors' && indent >= 2) {
      const kv = line.trim().match(/^([A-Za-z_]+):\s*(.*)$/);
      if (!kv) continue;
      const [, key, rawVal] = kv;
      if (key === 'sha') item.anchors.sha = stripQuotes(rawVal);
      else if (key === 'plan') item.anchors.plan = stripQuotes(rawVal);
      else if (key === 'files') {
        const list = parseInlineList(rawVal);
        if (list) item.anchors.files = list;
      }
      continue;
    }

    if (ctx === 'phases' && indent >= 2) {
      const dash = line.trim().match(/^-\s*name:\s*(.*)$/);
      if (dash) { item.phases.push({ name: stripQuotes(dash[1]), status: '' }); continue; }
      const kv = line.trim().match(/^([A-Za-z_]+):\s*(.*)$/);
      if (kv && item.phases.length) {
        if (kv[1] === 'status') item.phases[item.phases.length - 1].status = stripQuotes(kv[2]);
        // per-phase 'delta' etc. ignored by scripts
      }
      continue;
    }
  }
  return item;
}

export function listItems(storeDir) {
  if (!storeDir || !existsSync(storeDir)) return [];
  return readdirSync(storeDir)
    .filter(f => ITEM_RE.test(f))
    .sort()
    .map(f => parseItem(readFileSync(join(storeDir, f), 'utf8'), join(storeDir, f)));
}

export function findStore(startDir, gitRoot) {
  for (const base of [startDir, gitRoot].filter(Boolean)) {
    const p = join(base, '.throughline');
    if (existsSync(p)) return p;
  }
  return null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/store.test.mjs`
Expected: PASS (4 tests). Then remove the smoke test: `rm test/smoke.test.mjs`.

- [ ] **Step 5: Commit**

```bash
git rm test/smoke.test.mjs
git add scripts/lib/store.mjs test/store.test.mjs
git commit -m "feat(store): shallow frontmatter parser + item listing"
```

---

### Task 3: Surface renderer

**Files:**
- Create: `scripts/lib/render.mjs`
- Test: `test/render.test.mjs`

**Interfaces:**
- Consumes: `Item[]` from Task 2.
- Produces: `renderSurface(items: Item[]) → string` — returns `''` for an empty list; otherwise a compact block: a header line, then one line per item with id, title, status/phase-progress, and a `⚠ stale` marker when `item.stale`.

- [ ] **Step 1: Write the failing test**

`test/render.test.mjs`:
```js
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/render.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`scripts/lib/render.mjs`:
```js
function phaseProgress(phases) {
  if (!phases || phases.length === 0) return null;
  const done = phases.filter(p => p.status === 'done').length;
  const next = phases.find(p => p.status !== 'done');
  const resume = next ? `, resume ${next.name}` : '';
  return `${done}/${phases.length} phases${resume}`;
}

export function renderSurface(items) {
  if (!items || items.length === 0) return '';
  const lines = [`📌 throughline — ${items.length} open item${items.length > 1 ? 's' : ''} in this project:`];
  for (const it of items) {
    const prog = phaseProgress(it.phases);
    const detail = prog ? prog : it.status;
    const stale = it.stale ? '  ⚠ stale' : '';
    lines.push(`  [${it.id}] ${it.title} — ${detail}${stale}`);
  }
  lines.push('Pick one to work on: /throughline ship <id>. (Nothing runs until you pick.)');
  return lines.join('\n');
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/render.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/render.mjs test/render.test.mjs
git commit -m "feat(render): compact, phase-aware surface summary"
```

---

### Task 4: Drift logic (pure)

**Files:**
- Create: `scripts/lib/drift.mjs`
- Test: `test/drift.test.mjs`

**Interfaces:**
- Consumes: `Item` from Task 2.
- Produces: `computeStaleness(item: Item, ctx: { headSha: string, changedFiles: string[] }) → { stale: boolean, reason: string }`.
  - Not stale if `item.anchors.sha` is falsy / `'none'`, or equals `headSha`.
  - Stale if any `item.anchors.files` entry appears in `changedFiles`; reason names the count.
  - Otherwise not stale (HEAD moved but none of the anchored files changed).

- [ ] **Step 1: Write the failing test**

`test/drift.test.mjs`:
```js
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/drift.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`scripts/lib/drift.mjs`:
```js
export function computeStaleness(item, { headSha, changedFiles }) {
  const sha = item?.anchors?.sha;
  if (!sha || sha === 'none') return { stale: false, reason: '' };
  if (sha === headSha) return { stale: false, reason: '' };
  const anchored = item.anchors.files || [];
  const changed = new Set(changedFiles || []);
  const hits = anchored.filter(f => changed.has(f));
  if (hits.length === 0) return { stale: false, reason: '' };
  return { stale: true, reason: `${hits.length} anchored file(s) changed since capture: ${hits.join(', ')}` };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/drift.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/drift.mjs test/drift.test.mjs
git commit -m "feat(drift): pure staleness computation from sha + changed files"
```

---

### Task 5: Git helper (best-effort, isolated I/O)

**Files:**
- Create: `scripts/lib/git.mjs`
- Test: `test/store.test.mjs` (append an integration test)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `headSha(cwd: string) → string` — current `HEAD` sha, or `''` if not a git repo / no commits.
  - `changedFilesSince(cwd: string, sha: string) → string[]` — files changed between `sha` and `HEAD` (repo-relative), or `[]` on any error.
  - `gitRoot(cwd: string) → string | null` — toplevel dir, or null.

- [ ] **Step 1: Write the failing test**

Append to `test/store.test.mjs`:
```js
import { execFileSync } from 'node:child_process';
import { headSha, changedFilesSince, gitRoot } from '../scripts/lib/git.mjs';

test('git helpers work in a real temp repo, degrade elsewhere', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tlgit-'));
  const g = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'pipe' });
  g('init', '-q');
  g('config', 'user.email', 't@t.t');
  g('config', 'user.name', 'T');
  writeFileSync(join(dir, 'a.txt'), '1');
  g('add', '.'); g('commit', '-qm', 'one');
  const first = headSha(dir);
  assert.match(first, /^[0-9a-f]{7,40}$/);
  writeFileSync(join(dir, 'a.txt'), '2');
  g('add', '.'); g('commit', '-qm', 'two');
  assert.deepEqual(changedFilesSince(dir, first), ['a.txt']);
  assert.equal(gitRoot(dir), dir);

  const nogit = mkdtempSync(join(tmpdir(), 'nogit-'));
  assert.equal(headSha(nogit), '');
  assert.deepEqual(changedFilesSince(nogit, 'abc'), []);
  assert.equal(gitRoot(nogit), null);
});
```
(macOS `git rev-parse --show-toplevel` may return a `/private`-prefixed path for `/tmp`; if the equality assert is flaky on the runner, assert `gitRoot(dir).endsWith(basename(dir))` instead.)

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/store.test.mjs`
Expected: FAIL — `Cannot find module '../scripts/lib/git.mjs'`.

- [ ] **Step 3: Write the implementation**

`scripts/lib/git.mjs`:
```js
import { execFileSync } from 'node:child_process';

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

export function headSha(cwd) {
  try { return git(cwd, ['rev-parse', 'HEAD']).trim(); } catch { return ''; }
}

export function changedFilesSince(cwd, sha) {
  if (!sha) return [];
  try {
    return git(cwd, ['diff', '--name-only', `${sha}..HEAD`])
      .split('\n').map(s => s.trim()).filter(Boolean);
  } catch { return []; }
}

export function gitRoot(cwd) {
  try { return git(cwd, ['rev-parse', '--show-toplevel']).trim() || null; } catch { return null; }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/store.test.mjs`
Expected: PASS (all store + git tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/git.mjs test/store.test.mjs
git commit -m "feat(git): best-effort head sha, changed files, root"
```

---

### Task 6: `new-item.mjs` — the Capture scaffold helper

**Files:**
- Create: `scripts/new-item.mjs`
- Test: `test/new-item.test.mjs`

**Interfaces:**
- Consumes: `store.listItems`, `git.headSha`, `git.gitRoot`.
- Produces:
  - `nextId(items: Item[]) → string` — max numeric id + 1, zero-padded to 4 (`'0001'` for empty).
  - `scaffold({ id, title, sha }) → string` — the frontmatter template a fresh item starts from.
  - `main(argv: string[], { cwd, headSha, gitRoot }) → string` — resolves the store dir (creates `.throughline/` at git root or cwd), writes `NNNN.md`, returns the absolute path. Injected deps make it testable.

- [ ] **Step 1: Write the failing test**

`test/new-item.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nextId, scaffold, main } from '../scripts/new-item.mjs';

test('nextId increments the max, pads to 4', () => {
  assert.equal(nextId([]), '0001');
  assert.equal(nextId([{ id: '0001' }, { id: '0007' }]), '0008');
});

test('scaffold contains the required frontmatter keys', () => {
  const s = scaffold({ id: '0001', title: 'Add search', sha: 'abc1234' });
  assert.match(s, /^---\n/);
  assert.match(s, /id: 0001/);
  assert.match(s, /title: Add search/);
  assert.match(s, /status: parked/);
  assert.match(s, /sha: abc1234/);
  assert.match(s, /intent:/);
  assert.match(s, /open_questions:/);
});

test('main creates .throughline/NNNN.md with stamped sha', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'cap-'));
  const path = main(['Add', 'dark', 'mode'], { cwd, headSha: () => 'deadbee', gitRoot: () => null });
  assert.ok(existsSync(path));
  assert.match(path, /\.throughline\/0001\.md$/);
  const txt = readFileSync(path, 'utf8');
  assert.match(txt, /title: Add dark mode/);
  assert.match(txt, /sha: deadbee/);
});

test('main stamps sha: none when not a git repo (headSha empty)', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'cap2-'));
  const path = main(['x'], { cwd, headSha: () => '', gitRoot: () => null });
  assert.match(readFileSync(path, 'utf8'), /sha: none/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/new-item.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`scripts/new-item.mjs`:
```js
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { listItems } from './lib/store.mjs';
import { headSha as realHeadSha, gitRoot as realGitRoot } from './lib/git.mjs';

export function nextId(items) {
  const max = items.reduce((m, i) => Math.max(m, parseInt(i.id, 10) || 0), 0);
  return String(max + 1).padStart(4, '0');
}

export function scaffold({ id, title, sha }) {
  return `---
id: ${id}
title: ${title}
status: parked
intent: ""            # what + why it matters (fill in)
decisions: []         # settled choices/constraints the next session must respect
open_questions: []    # unresolved — Ship will ask ONLY these
acceptance: ""        # done when …
anchors:
  sha: ${sha}
  files: []           # relevant paths, so a cold session points at ground truth
  plan: ""            # path to a plan file if this is phased
phases: []            # add phases only if multi-step
---
`;
}

export function main(argv, deps = {}) {
  const cwd = deps.cwd || process.cwd();
  const headSha = deps.headSha || realHeadSha;
  const gitRoot = deps.gitRoot || realGitRoot;
  const title = argv.join(' ').trim() || 'Untitled item';
  const root = gitRoot(cwd) || cwd;
  const storeDir = join(root, '.throughline');
  mkdirSync(storeDir, { recursive: true });
  const id = nextId(listItems(storeDir));
  const sha = headSha(cwd) || 'none';
  const file = join(storeDir, `${id}.md`);
  writeFileSync(file, scaffold({ id, title, sha }));
  return file;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const path = main(process.argv.slice(2));
  process.stdout.write(path + '\n');
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/new-item.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/new-item.mjs test/new-item.test.mjs
git commit -m "feat(capture): new-item scaffold helper with id + git anchor"
```

---

### Task 7: Surface hook + `list-items` / `drift-check` CLIs

**Files:**
- Create: `hooks/throughline-surface.mjs`
- Create: `scripts/list-items.mjs`
- Create: `scripts/drift-check.mjs`
- Test: `test/surface-hook.test.mjs`

**Interfaces:**
- Consumes: `store`, `render`, `drift`, `git` libs.
- Produces:
  - `buildSurface({ storeDir, cwd, headSha, changedFilesSince }) → string` — lists items, computes staleness per item (skipping git when `headSha` empty), returns the rendered summary (or `''`).
  - Hook entrypoint prints Claude Code SessionStart JSON `{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext": <summary>}}` **only when the summary is non-empty**; otherwise prints nothing and exits 0.

> **Verify during implementation:** confirm the exact SessionStart context-injection contract in the current Claude Code docs (JSON `hookSpecificOutput.additionalContext` on stdout, exit 0). If the contract differs, adjust only the `emit()` wrapper in the entrypoint — `buildSurface` stays unchanged. Use the `claude-code-guide` agent to confirm.

- [ ] **Step 1: Write the failing test**

`test/surface-hook.test.mjs`:
```js
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/surface-hook.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementations**

`hooks/throughline-surface.mjs`:
```js
import { listItems } from '../scripts/lib/store.mjs';
import { renderSurface } from '../scripts/lib/render.mjs';
import { computeStaleness } from '../scripts/lib/drift.mjs';
import { headSha as realHeadSha, changedFilesSince as realChanged, gitRoot } from '../scripts/lib/git.mjs';

export function buildSurface({ storeDir, cwd, headSha = realHeadSha, changedFilesSince = realChanged }) {
  if (!storeDir) return '';
  const items = listItems(storeDir);
  if (items.length === 0) return '';
  const head = cwd ? headSha(cwd) : '';
  for (const it of items) {
    if (!head) continue; // non-git: skip drift, never guess
    const { stale, reason } = computeStaleness(it, { headSha: head, changedFiles: changedFilesSince(cwd, it.anchors.sha) });
    it.stale = stale; it.staleReason = reason;
  }
  return renderSurface(items);
}

function emit(summary) {
  if (!summary) return; // silent no-op: never nag
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: summary },
  }) + '\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cwd = process.cwd();
  const { findStore } = await import('../scripts/lib/store.mjs');
  const storeDir = findStore(cwd, gitRoot(cwd));
  emit(buildSurface({ storeDir, cwd }));
}
```

`scripts/list-items.mjs`:
```js
import { findStore, listItems } from './lib/store.mjs';
import { renderSurface } from './lib/render.mjs';
import { gitRoot } from './lib/git.mjs';

const cwd = process.cwd();
const store = findStore(cwd, gitRoot(cwd));
const out = renderSurface(listItems(store || ''));
process.stdout.write((out || 'No throughline items in this project.') + '\n');
```

`scripts/drift-check.mjs`:
```js
import { findStore, listItems } from './lib/store.mjs';
import { computeStaleness } from './lib/drift.mjs';
import { headSha, changedFilesSince, gitRoot } from './lib/git.mjs';

const cwd = process.cwd();
const store = findStore(cwd, gitRoot(cwd));
const items = listItems(store || '');
const head = headSha(cwd);
let any = false;
for (const it of items) {
  if (!head) break;
  const { stale, reason } = computeStaleness(it, { headSha: head, changedFiles: changedFilesSince(cwd, it.anchors.sha) });
  if (stale) { any = true; process.stdout.write(`[${it.id}] ${it.title} — ${reason}\n`); }
}
if (!any) process.stdout.write('No stale items.\n');
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/surface-hook.test.mjs`
Expected: PASS (2 tests). Then smoke the CLIs: `node scripts/list-items.mjs` (in the plugin repo, prints "No throughline items...").

- [ ] **Step 5: Commit**

```bash
git add hooks/throughline-surface.mjs scripts/list-items.mjs scripts/drift-check.mjs test/surface-hook.test.mjs
git commit -m "feat(surface): session-start summary + list/drift CLIs"
```

---

### Task 8: Manifests (plugin.json, marketplace.json, hooks, Codex adapter)

**Files:**
- Create: `.claude-plugin/plugin.json`
- Create: `.claude-plugin/marketplace.json`
- Create: `.codex-plugin/plugin.json`
- Create: `hooks/throughline-hooks.json`
- Test: `test/manifests.test.mjs`

**Interfaces:**
- Consumes: the hook script + skills dir on disk.
- Produces: valid installable manifests. The hooks JSON wires `SessionStart(matcher=startup|resume|clear|compact)` to the surface script with a **node-missing guard** so it is a silent no-op without Node.

- [ ] **Step 1: Write the failing test**

`test/manifests.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = p => JSON.parse(readFileSync(p, 'utf8'));

test('plugin.json points at real hooks + skills', () => {
  const p = read('.claude-plugin/plugin.json');
  assert.equal(p.name, 'throughline');
  assert.ok(existsSync(p.hooks.replace('./', '')));
  assert.ok(existsSync('skills/throughline-capture/SKILL.md')); // created in later tasks
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
  const cmd = start.hooks[0].command;
  assert.match(cmd, /throughline-surface\.mjs/);
  assert.match(cmd, /command -v node/); // silent no-op guard when node absent
});
```

> Note: the two `existsSync('skills/...')` assertions depend on Tasks 9–10. Run this test file's third case now; run the full file after Task 11. If executing strictly in order, mark the skill-path asserts pending until Task 11 (they are re-run in Task 13's integration check).

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/manifests.test.mjs`
Expected: FAIL — files not found.

- [ ] **Step 3: Write the manifests**

`.claude-plugin/plugin.json`:
```json
{
  "name": "throughline",
  "version": "0.1.0",
  "description": "Keep the throughline across every session. Surfaces your project backlog at session start and hands phased work to fresh sessions without drift.",
  "author": { "name": "Enrique Aylagas", "url": "https://github.com/enriqueaylagas" },
  "homepage": "https://github.com/enriqueaylagas/throughline",
  "hooks": "./hooks/throughline-hooks.json",
  "skills": "./skills/"
}
```

`.claude-plugin/marketplace.json`:
```json
{
  "$schema": "https://anthropic.com/claude-code/marketplace.schema.json",
  "name": "throughline",
  "description": "The backlog that remembers why, not just what. Anti-drift phase handoffs for fresh sessions.",
  "owner": { "name": "Enrique Aylagas", "url": "https://github.com/enriqueaylagas" },
  "plugins": [
    {
      "name": "throughline",
      "description": "Surfaces pending work at session start; hands phased work to fresh sessions without drift.",
      "source": "./",
      "category": "productivity"
    }
  ]
}
```

`hooks/throughline-hooks.json`:
```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume|clear|compact",
        "hooks": [
          {
            "type": "command",
            "command": "command -v node >/dev/null 2>&1 && node \"${CLAUDE_PLUGIN_ROOT}/hooks/throughline-surface.mjs\" || true",
            "commandWindows": "if (Get-Command node -ErrorAction SilentlyContinue) { node \"$env:CLAUDE_PLUGIN_ROOT\\hooks\\throughline-surface.mjs\" }",
            "timeout": 5,
            "statusMessage": "Surfacing throughline..."
          }
        ]
      }
    ]
  }
}
```

`.codex-plugin/plugin.json`:
```json
{
  "name": "throughline",
  "version": "0.1.0",
  "description": "Keep the throughline across every session (Codex adapter).",
  "hooks": "./hooks/throughline-hooks.json",
  "skills": "./skills/"
}
```

- [ ] **Step 4: Run to verify the matcher/JSON tests pass**

Run: `node --test test/manifests.test.mjs`
Expected: the matcher + marketplace tests PASS; the two `skills/...` existence asserts fail until Task 11 (expected — re-run in Task 13).

- [ ] **Step 5: Commit**

```bash
git add .claude-plugin .codex-plugin hooks/throughline-hooks.json test/manifests.test.mjs
git commit -m "feat(dist): plugin + marketplace + hooks manifests, Codex adapter"
```

---

### Task 9: `references/item-schema.md`

**Files:**
- Create: `references/item-schema.md`

**Interfaces:**
- Consumes: the `Item` shape (Task 2) and scaffold (Task 6).
- Produces: the human/agent reference both skills point at. No test (documentation), validated by the Task 13 integration check that referenced files exist.

- [ ] **Step 1: Write the reference**

`references/item-schema.md`:
````markdown
# throughline item schema

One Markdown file per item at `.throughline/NNNN.md` in the consuming project.
Frontmatter is read by scripts (shallow fields) **and** by the agent (everything).
Scripts never parse `decisions`, `open_questions`, `acceptance`, per-phase `delta`,
or the body — those are for the agent to read directly.

**Principle:** *point, don't summarize.* Capture only what a fresh session cannot
re-read from the code or the plan file. Do not restate what the diff already shows.

```yaml
---
id: 0007                     # 4-digit, assigned by scripts/new-item.mjs
title: Add dark mode toggle  # one line
status: parked               # parked | in-progress | done
intent: |                    # what + WHY it matters (the part that evaporates)
  Night-shift users asked for it; must not touch the existing print stylesheet.
decisions:                   # settled choices a cold session MUST respect
  - "CSS variables only, no theme library (bundle budget)"
open_questions:              # unresolved — Ship asks ONLY these
  - "Should the toggle persist per-device or per-account?"
acceptance: "Toggle in header; persists; respects prefers-color-scheme on first load"
anchors:
  sha: abc1234               # git HEAD at capture — the drift baseline
  files: [src/theme.css, src/App.tsx]   # where the work lives / ground truth
  plan: docs/plan.md         # source of truth for phases (if phased)
phases:                      # omit for atomic items
  - name: Phase 1 — tokens
    status: done
    delta: |                 # the irreducible handoff for THIS phase
      Chose OKLCH tokens in theme.css; App.tsx reads --bg/--ink. Deviated from
      plan: skipped the SSR flash-guard, tracked as open_question below.
  - name: Phase 2 — toggle UI
    status: pending
---
Free-form notes. Anything not worth structuring.
```

**Atomic item (minimum):**
```yaml
---
id: 0001
title: Fix the 404 on /pricing
status: parked
intent: "Broken since the router refactor; blocks the launch checklist"
acceptance: "/pricing renders the pricing page"
anchors:
  sha: 9f2a1c0
  files: [src/router.tsx]
---
```
````

- [ ] **Step 2: Commit**

```bash
git add references/item-schema.md
git commit -m "docs(schema): item file reference"
```

---

### Task 10: Capture skill (`skills/throughline-capture/SKILL.md`)

**Files:**
- Create: `skills/throughline-capture/SKILL.md`
- Test: `test/manifests.test.mjs` (append a frontmatter/structure check)

**Interfaces:**
- Consumes: `scripts/new-item.mjs`, `references/item-schema.md`.
- Produces: the instructions for park + checkpoint. Validated structurally.

- [ ] **Step 1: Write the failing test**

Append to `test/manifests.test.mjs`:
```js
import { readFileSync as rf } from 'node:fs';

test('capture SKILL.md has frontmatter name + description and references the schema', () => {
  const s = rf('skills/throughline-capture/SKILL.md', 'utf8');
  assert.match(s, /^---\nname: throughline-capture\n/);
  assert.match(s, /description:/);
  assert.match(s, /new-item\.mjs/);
  assert.match(s, /item-schema\.md/);
  assert.match(s, /checkpoint/i);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/manifests.test.mjs`
Expected: FAIL — capture SKILL.md not found.

- [ ] **Step 3: Write the skill**

`skills/throughline-capture/SKILL.md`:
````markdown
---
name: throughline-capture
description: "Use to park a pending idea or checkpoint a phase boundary into the project's throughline (backlog) so a future fresh session can act on it without re-explanation. Triggers: 'park this', 'add to backlog', 'throughline this', '/throughline add', '/throughline checkpoint', or finishing a phase in a long session."
license: MIT
---

# throughline — Capture

Capture pending work so a **cold future session** can execute it without you
re-explaining. Two flavors: **park** (something for later) and **checkpoint**
(a handoff at a phase boundary). Read `references/item-schema.md` before writing
any item file.

**Core principle — point, don't summarize.** Record only what a fresh session
*cannot* re-read from the code or the plan file: the *why*, the decisions, the
gotchas, the deviations. Never restate what `git diff` already shows.

## Park (a new item)

1. Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/new-item.mjs "<short title>"`. It creates
   `.throughline/NNNN.md` with the id and the current git SHA pre-stamped, and prints the path.
2. Open that file and fill it in **from the conversation you are already in** — do not
   ask the user to retype what was just discussed. Harvest:
   - `intent`: what and, above all, *why it matters*.
   - `decisions`: choices already settled ("must use X", "don't touch Y").
   - `open_questions`: anything genuinely unresolved. Ship will ask only these.
   - `acceptance`: done-when.
   - `anchors.files`: the paths the work touches (ground truth for a cold session).
3. Confirm in one line: "Parked [id] <title>." Do not start implementing.

## Checkpoint (a phase handoff)

Use at the end of a phase in a long session, when the next phase should run fresh.

1. Identify the item (its `anchors.plan` is the source of truth). If the phased work
   isn't tracked yet, park it first with a `plan:` anchor pointing at the plan file.
2. Set the finished phase's `status: done` and write its `delta` — **only** the
   irreducible handoff: decisions made this phase, gotchas, and any deviation from the
   plan *and why*. Do not summarize the code; the next session reads the diff and the plan.
3. Ensure the next phase exists with `status: pending`.
4. Confirm: "Checkpointed [id] at <phase>. A fresh session can resume with /throughline ship <id>."

## Never

- Never dump a prose recap of the code into `delta`/`intent` — that reintroduces the
  lossy-handoff drift this exists to prevent.
- Never begin implementation from Capture. Capture records; Ship executes.
````

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/manifests.test.mjs`
Expected: the capture-skill test PASSES (marketplace/matcher still pass; ship-skill existence still pending until Task 11).

- [ ] **Step 5: Commit**

```bash
git add skills/throughline-capture/SKILL.md test/manifests.test.mjs
git commit -m "feat(capture): park + checkpoint skill"
```

---

### Task 11: Ship skill (`skills/throughline-ship/SKILL.md`)

**Files:**
- Create: `skills/throughline-ship/SKILL.md`
- Test: `test/manifests.test.mjs` (append)

**Interfaces:**
- Consumes: `scripts/drift-check.mjs`, `references/item-schema.md`, item files, ponytail (composed), superpowers plan format.
- Produces: the cold-start execution protocol. Validated structurally.

- [ ] **Step 1: Write the failing test**

Append to `test/manifests.test.mjs`:
```js
test('ship SKILL.md has frontmatter and the anti-drift protocol', () => {
  const s = rf('skills/throughline-ship/SKILL.md', 'utf8');
  assert.match(s, /^---\nname: throughline-ship\n/);
  assert.match(s, /re-validate/i);      // re-validate before writing
  assert.match(s, /ponytail/i);         // minimal writing
  assert.match(s, /drift-check\.mjs/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/manifests.test.mjs`
Expected: FAIL — ship SKILL.md not found.

- [ ] **Step 3: Write the skill**

`skills/throughline-ship/SKILL.md`:
````markdown
---
name: throughline-ship
description: "Use when the user picks a throughline item to implement (e.g. '/throughline ship 0007', 'work on the auth migration', 'resume phase 2'). Cold-starts the item from its captured context, re-validates against the plan, then implements minimally. Not for capturing — that's throughline-capture."
license: MIT
---

# throughline — Ship

Execute a picked item from a **cold start**, staying faithful to the plan. The whole
point is that a fresh session resumes phased work *without drifting* — so reconstruct
from ground truth, not from a prose recap.

## Protocol (in order)

1. **Load the item.** Read `.throughline/<id>.md` in full (frontmatter *and* body —
   decisions, open_questions, per-phase delta). If it has `anchors.plan`, read that plan
   file: it is the **source of truth** for what each phase must be.
2. **Reconstruct from ground truth.** Read `anchors.files`. For a phased item, read the
   `delta` of completed phases and the actual diff — do not trust any summary over the code.
3. **Check drift.** Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/drift-check.mjs`. If the item is
   stale, tell the user what changed before proceeding.
4. **Re-validate BEFORE writing.** State, in one or two lines, your understanding of the next
   phase and confirm it matches the plan file. If it does not match, surface the mismatch and
   stop — do not write code past a drift. (This is the step that prevents fresh-session drift.)
5. **Resolve gaps.** Read the codebase first. Ask the user **only** the item's `open_questions`
   plus any *new* decision-level ambiguity. Never re-ask what capture already recorded.
6. **Implement minimally.** Compose the ponytail ladder: reuse/stdlib/native/one-line before
   writing new code. Ship the smallest change that satisfies `acceptance`.
7. **Report & update.** State what changed. Update the item: advance `phases[].status`, set
   `status: done` when acceptance is met, or checkpoint (hand to throughline-capture) if you
   stopped at a phase boundary.

## Safety carve-outs (never cross)

- Stop and confirm before anything destructive or irreversible.
- Never guess on decision-level ambiguity — ask.
- If drift is detected at step 4, surface it; do not proceed on a stale understanding.
- `ponytail` shortens the *solution*, never the *reading* or the safety guards
  (validation, error handling, security, accessibility).

## Degradation

In Claude Code you may fan out subagents for independent sub-tasks of this one item.
In Codex, run sequentially. Never fan out across *multiple* items — one picked item at a time.
````

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/manifests.test.mjs`
Expected: PASS — all manifest + both skill tests now pass (the `skills/...` existence asserts from Task 8 now resolve too).

- [ ] **Step 5: Commit**

```bash
git add skills/throughline-ship/SKILL.md test/manifests.test.mjs
git commit -m "feat(ship): cold-start, re-validate, minimal-write protocol"
```

---

### Task 12: `/throughline` command + AGENTS.md instruction tier

**Files:**
- Create: `commands/throughline.md`
- Create: `AGENTS.md`

**Interfaces:**
- Consumes: the two skills, `new-item.mjs`, `list-items.mjs`.
- Produces: the slash-command router and the instruction-tier fallback. No unit test; covered by Task 13 integration.

- [ ] **Step 1: Write the command**

`commands/throughline.md`:
````markdown
---
description: "Manage the project throughline: list, add, checkpoint, or ship pending work."
argument-hint: "[list | add <title> | checkpoint | ship <id>]"
---

Route based on the argument:

- **(no arg) or `list`** — run `node ${CLAUDE_PLUGIN_ROOT}/scripts/list-items.mjs` and show the throughline.
- **`add <title>`** — invoke the `throughline-capture` skill (park flavor) for `<title>`.
- **`checkpoint`** — invoke the `throughline-capture` skill (checkpoint flavor) for the current work.
- **`ship <id>`** — invoke the `throughline-ship` skill for item `<id>`.

Never start implementing on `list`/`add`/`checkpoint`. Only `ship` executes.
````

- [ ] **Step 2: Write the instruction-tier fallback**

`AGENTS.md`:
````markdown
# throughline (instruction-tier)

This project uses **throughline** to remember pending work across sessions. On hosts
without plugin hooks, honor these rules manually:

- **At session start**, if a `.throughline/` folder exists, read its `NNNN.md` files and
  tell the user what's pending (id, title, phase progress). Do not start work — wait for a pick.
- **To park** an idea: create `.throughline/NNNN.md` (next free 4-digit id) following the
  format in this plugin's `references/item-schema.md`. Capture the *why*, decisions, open
  questions, acceptance, and the files it touches — harvested from the current conversation.
- **To checkpoint** a phase: set the finished phase `status: done`, write its `delta` (only the
  irreducible handoff — never a code recap), and ensure the next phase is `pending`.
- **To ship** an item: read it in full and its `plan:` anchor; re-validate your understanding
  against the plan **before** writing; resolve gaps from the codebase, asking only the item's
  open questions; implement minimally; then update the item's status.

Full-tier hosts (Claude Code, Codex) automate the session-start surfacing via a hook.
````

- [ ] **Step 3: Commit**

```bash
git add commands/throughline.md AGENTS.md
git commit -m "feat: /throughline command + AGENTS.md instruction tier"
```

---

### Task 13: End-to-end integration test (fresh-session simulation)

**Files:**
- Create: `test/integration.test.mjs`

**Interfaces:**
- Consumes: everything. Simulates capture → (new session) → surface → ship-readiness in a temp git repo, exercising the real scripts as a user would.

- [ ] **Step 1: Write the integration test**

`test/integration.test.mjs`:
```js
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
```

- [ ] **Step 2: Run to verify it passes**

Run: `node --test test/integration.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 3: Run the whole suite**

Run: `npm test`
Expected: all tests across all files PASS.

- [ ] **Step 4: Commit**

```bash
git add test/integration.test.mjs
git commit -m "test: end-to-end capture → surface fresh-session simulation"
```

---

### Task 14: Local install smoke test (manual verification)

**Files:**
- Modify: none (manual verification + a short `docs/INSTALL-VERIFY.md` note)
- Create: `docs/INSTALL-VERIFY.md`

**Interfaces:**
- Consumes: the whole plugin.
- Produces: recorded evidence that a real Claude Code session surfaces the throughline with no prompt.

- [ ] **Step 1: Install locally into Claude Code**

Run (in Claude Code): `/plugin marketplace add <local path or user>/throughline` then `/plugin install throughline@throughline`.

- [ ] **Step 2: Create a throughline item in a scratch project and start a fresh session**

In a git project: `node <plugin>/scripts/new-item.mjs "Try throughline"`, then `/clear`.
Expected: the fresh session shows the throughline summary automatically, **no prompt**. Confirm nothing executes.

- [ ] **Step 3: Verify the graceful no-op**

In a project with no `.throughline/`, `/clear`.
Expected: no throughline output, no error.

- [ ] **Step 4: Record evidence**

Write `docs/INSTALL-VERIFY.md` with: the two outcomes observed (surface-on-clear; silent no-op), Claude Code version, and the confirmed SessionStart output contract (from the Task 7 verification). If the contract differed from the assumed JSON shape, note the exact working form.

- [ ] **Step 5: Commit**

```bash
git add docs/INSTALL-VERIFY.md
git commit -m "docs: local install verification evidence"
```

---

## Self-Review

**Spec coverage** (each spec section → task):
- §4 Surface hook → Tasks 3, 7, 8 (matcher), 14 (verified). Capture → Tasks 6, 10. Ship → Task 11.
- §5 architecture/layout → all tasks; file tree matches (`.mjs` per Global Constraints).
- §6 data model / item schema → Tasks 2 (parse), 6 (scaffold), 9 (reference).
- §7 mechanisms: harvest → Task 10; checkpoint handoff → Task 10; drift detection → Tasks 4, 7; ship re-validate → Task 11.
- §8 distribution: manifests + adapters → Task 8, 12 (AGENTS.md), Codex adapter → Task 8.
- §8b adoption deliverables (README, benchmark, examples, LICENSE) → **deferred to Plan B** (noted below); LICENSE field set in package.json/manifests here.
- §9 safety carve-outs → Task 11 (explicit section).
- §10 reuse (ponytail, plan format) → Task 11 protocol.
- §11 acceptance: #1 park&resume → Task 13; #2 phase-handoff-no-drift (hero) → **Plan B benchmark** exercises it end-to-end; the mechanism (checkpoint + re-validate) ships in Tasks 10–11; #3 staleness → Tasks 4/7/13; #4 gap resolution → Task 11; #5 safety → Task 11; #6 cross-tool → Tasks 8/12.
- §12 scope v1 behavior + distribution → covered; adoption row → Plan B.
- §13 decisions: script language = Node (resolved, Global Constraints); proof metric → Plan B.

**Gap noted:** acceptance #2's *measurement* (the fidelity benchmark) and the README/examples/LICENSE-file are **Plan B**. Everything needed to *pass* #2 behaviorally (checkpoint capture + re-validate-before-write) is in this plan. This is an intentional split, not an omission.

**Placeholder scan:** no TBD/TODO; every code step shows complete code; every skill/manifest is written in full. The one flagged uncertainty (SessionStart stdout contract) has an explicit verification step (Task 7 note + Task 14) and is isolated to the `emit()` wrapper.

**Type consistency:** `Item` shape is defined once and used identically in `parseItem`/`listItems` (Task 2), `renderSurface` (Task 3), `computeStaleness` (Task 4), `buildSurface` (Task 7). Function names are stable across tasks: `findStore`, `listItems`, `parseItem`, `renderSurface`, `computeStaleness`, `headSha`, `changedFilesSince`, `gitRoot`, `nextId`, `scaffold`, `main`, `buildSurface`. Hook filename `throughline-surface.mjs` is identical in the hooks JSON (Task 8), the surface script (Task 7), and both integration tests.

---

## Plan B (next, not this plan)

The **adoption layer** — a real work-item set once the plugin works:
1. `README.md` — the sticky one-liner, the manual-handoff-drift before/after, honest lineage (Task Master/Backlog.md store tasks; superpowers persists phases; throughline adds the layer they don't), 30-second install, badges.
2. `benchmarks/` — the reproducible handoff-fidelity harness for acceptance #2 (fresh session on a hand-written paste-prompt vs. throughline, scored on plan adherence), with method + limitations stated honestly. **Resolve the proof-metric open decision here.**
3. `examples/` — concrete parked-item and phase-handoff before/afters.
4. `LICENSE` (MIT file), CI (`node --test` on push), social preview.
```
