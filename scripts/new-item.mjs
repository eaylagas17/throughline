import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { listItems } from './lib/store.mjs';
import { headSha as realHeadSha, gitRoot as realGitRoot } from './lib/git.mjs';

export function nextId(items) {
  const max = items.reduce((m, i) => Math.max(m, parseInt(i.id, 10) || 0), 0);
  return String(max + 1).padStart(4, '0');
}

export function scaffold({ id, title, sha }) {
  return `---
id: ${id}
title: ${JSON.stringify(title)}
status: parked
# intent: what + why it matters (fill in)
intent: ""
# decisions: settled choices/constraints the next session must respect
decisions: []
# open_questions: unresolved; Ship will ask ONLY these
open_questions: []
# acceptance: done when …
acceptance: ""
anchors:
  sha: ${sha}
  # files: relevant paths, so a cold session points at ground truth
  files: []
  # plan: path to a plan file if this is phased
  plan: ""
# phases: add phases only if multi-step
phases: []
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const path = main(process.argv.slice(2));
  process.stdout.write(path + '\n');
}
