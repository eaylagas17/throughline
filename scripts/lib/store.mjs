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
  let ctx = null; // 'anchors' | 'phases' | null — which top-level section we're inside
  let anchorsFilesBlock = false; // true while inside an `anchors.files:` block dash-list
  for (const line of lines) {
    if (!line.trim()) continue;
    const trimmed = line.trim();
    const indent = line.length - line.trimStart().length;
    const isDash = trimmed.startsWith('-');

    // A dash line belongs to the CURRENT section's list regardless of its
    // indent (YAML allows dashes at the same indent as their parent key).
    // Only a non-dash key at indent 0 starts a new top-level section / ends
    // the current one.
    if (indent === 0 && !isDash) {
      ctx = null;
      anchorsFilesBlock = false;
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

    if (ctx === 'anchors') {
      if (anchorsFilesBlock) {
        const item2 = trimmed.match(/^-\s*(.*)$/);
        if (item2) { item.anchors.files.push(stripQuotes(item2[1])); continue; }
        // A non-dash line at this point means the files block ended;
        // fall through to normal anchors key handling below.
        anchorsFilesBlock = false;
      }
      const kv = trimmed.match(/^([A-Za-z_]+):\s*(.*)$/);
      if (!kv) continue;
      const [, key, rawVal] = kv;
      const val = rawVal.trim();
      if (key === 'sha') item.anchors.sha = stripQuotes(val);
      else if (key === 'plan') item.anchors.plan = stripQuotes(val);
      else if (key === 'files') {
        if (val === '') { anchorsFilesBlock = true; continue; }
        const list = parseInlineList(val);
        if (list) item.anchors.files = list;
      }
      continue;
    }

    if (ctx === 'phases') {
      const dash = trimmed.match(/^-\s*name:\s*(.*)$/);
      if (dash) { item.phases.push({ name: stripQuotes(dash[1]), status: '' }); continue; }
      const kv = trimmed.match(/^([A-Za-z_]+):\s*(.*)$/);
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
