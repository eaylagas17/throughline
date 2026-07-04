import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { findStore } from './lib/store.mjs';
import { readSurfaceMode, writeSurfaceMode, SURFACE_MODES } from './lib/config.mjs';
import { gitRoot as realGitRoot } from './lib/git.mjs';

// Get or set how throughline surfaces at session start.
//   main([])         → { mode, changed:false }   (report current)
//   main(['off'])    → { mode:'off', changed:true } (persist)
export function main(argv, deps = {}) {
  const cwd = deps.cwd || process.cwd();
  const gitRoot = deps.gitRoot || realGitRoot;
  const arg = (argv[0] || '').trim().toLowerCase();
  if (!arg) {
    return { mode: readSurfaceMode(findStore(cwd, gitRoot(cwd))), changed: false };
  }
  if (!SURFACE_MODES.includes(arg)) {
    throw new Error(`unknown mode "${arg}" — use one of: ${SURFACE_MODES.join(', ')}`);
  }
  const storeDir = join(gitRoot(cwd) || cwd, '.throughline');
  writeSurfaceMode(storeDir, arg);
  return { mode: arg, changed: true };
}

const DESC = {
  auto: 'shows the backlog to you at session start (visible on startup and /clear, no injected turn)',
  passive: 'loads the backlog into context and surfaces on your first message',
  off: 'stays silent at session start',
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { mode, changed } = main(process.argv.slice(2));
  const verb = changed ? 'throughline surfacing set to' : 'throughline surfacing is';
  process.stdout.write(`${verb}: ${mode} — ${DESC[mode]}\n`);
}
