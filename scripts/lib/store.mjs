import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ITEM_RE = /^\d{4}\.md$/;

// YAML treats `#` as a comment only when preceded by whitespace (or at line
// start). The caller's `key:\s*` match already swallows the run of
// whitespace right after the colon, so a header line like `phases:   # x`
// hands us a value that is JUST the comment (no leading whitespace of its
// own); that's the "line start" case, and the whole value is the comment.
// A line like `sha: abc1234   # x` hands us "abc1234   # x", where the
// comment is preceded by (interior) whitespace, the "preceded by
// whitespace" case. Quoted values are left untouched: a `#` inside quotes
// is data, not a comment, and stripQuotes() below handles unwrapping quotes.
function stripInlineComment(s) {
  if (s.startsWith('"') || s.startsWith("'")) return s;
  if (s.startsWith('#')) return '';
  return s.replace(/\s+#.*$/, '');
}

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

// A YAML block scalar header: `|` or `>`, optionally followed by a chomping
// indicator (`-`/`+`) and/or an explicit indent indicator (1-9), in either
// order (`|-`, `|2`, `|-2`, `|2-`, ...). Anything after inline-comment
// stripping that matches this is NOT a plain scalar value; it introduces a
// multi-line body on the following, more-indented lines.
function isBlockScalarHeader(s) {
  return /^[|>](?:[+-]?[1-9]?|[1-9]?[+-]?)$/.test(s.trim());
}

// Minimal, tolerant frontmatter reader for the SHALLOW fields only.
export function parseItem(text, file = '') {
  text = text.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const item = {
    id: '', title: '', status: '', intent: '',
    anchors: { sha: '', files: [], plan: '' },
    phases: [], file,
  };
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return item;
  const lines = m[1].split('\n');
  let ctx = null; // 'anchors' | 'phases' | null: which top-level section we're inside
  let anchorsFilesBlock = false; // true while inside an `anchors.files:` block dash-list
  // While set, we are inside a block-scalar (`|`/`>`) body: { indent } holds
  // the indentation of the KEY that introduced it. Any line indented MORE
  // than that is body text, not structure, and must be skipped outright,
  // otherwise prose inside e.g. a phase's `delta: |` can be mistaken for a
  // `status:` key or a `- name:` phase entry.
  let blockScalar = null;
  for (const line of lines) {
    if (!line.trim()) continue;
    const trimmed = line.trim();
    const indent = line.length - line.trimStart().length;
    const isDash = trimmed.startsWith('-');

    if (blockScalar) {
      if (indent > blockScalar.indent) continue; // still inside the scalar body, skip
      blockScalar = null; // body ended; fall through and process this line normally
    }

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
      const val = stripInlineComment(rawVal.trim());
      if (key === 'anchors' && val === '') { ctx = 'anchors'; continue; }
      if (key === 'phases' && val === '') { ctx = 'phases'; continue; }
      if (isBlockScalarHeader(val)) {
        blockScalar = { indent };
        // Shallow scalar fields don't capture multi-line bodies; blank them.
        if (key === 'id') item.id = '';
        else if (key === 'title') item.title = '';
        else if (key === 'status') item.status = '';
        else if (key === 'intent') item.intent = '';
        continue;
      }
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
        if (item2) { item.anchors.files.push(stripQuotes(stripInlineComment(item2[1]))); continue; }
        // A non-dash line at this point means the files block ended;
        // fall through to normal anchors key handling below.
        anchorsFilesBlock = false;
      }
      const kv = trimmed.match(/^([A-Za-z_]+):\s*(.*)$/);
      if (!kv) continue;
      const [, key, rawVal] = kv;
      const val = stripInlineComment(rawVal.trim());
      if (isBlockScalarHeader(val)) {
        blockScalar = { indent };
        if (key === 'sha') item.anchors.sha = '';
        else if (key === 'plan') item.anchors.plan = '';
        continue;
      }
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
      if (dash) { item.phases.push({ name: stripQuotes(stripInlineComment(dash[1])), status: '' }); continue; }
      const kv = trimmed.match(/^([A-Za-z_]+):\s*(.*)$/);
      if (kv) {
        const val = stripInlineComment(kv[2].trim());
        if (isBlockScalarHeader(val)) {
          blockScalar = { indent };
          if (kv[1] === 'status' && item.phases.length) item.phases[item.phases.length - 1].status = '';
          continue;
        }
        if (kv[1] === 'status' && item.phases.length) item.phases[item.phases.length - 1].status = stripQuotes(val);
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
