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
