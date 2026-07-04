import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// How throughline surfaces the backlog at session start:
//   auto    — inject a first turn so the backlog appears immediately, no keystroke
//   passive — load it into context but wait for the user's first message (no injected turn)
//   off      — stay silent at session start
export const SURFACE_MODES = ['auto', 'passive', 'off'];
export const DEFAULT_SURFACE_MODE = 'auto';

function configPath(storeDir) {
  return join(storeDir, 'config.json');
}

// Tolerant read: a missing, malformed, or unknown-mode config all fall back to
// the default rather than throwing — the surface hook must never crash a session.
export function readSurfaceMode(storeDir) {
  if (!storeDir) return DEFAULT_SURFACE_MODE;
  const file = configPath(storeDir);
  if (!existsSync(file)) return DEFAULT_SURFACE_MODE;
  try {
    const cfg = JSON.parse(readFileSync(file, 'utf8'));
    const mode = cfg && cfg.surface;
    return SURFACE_MODES.includes(mode) ? mode : DEFAULT_SURFACE_MODE;
  } catch {
    return DEFAULT_SURFACE_MODE;
  }
}

export function writeSurfaceMode(storeDir, mode) {
  if (!SURFACE_MODES.includes(mode)) {
    throw new Error(`invalid surface mode "${mode}" — use one of: ${SURFACE_MODES.join(', ')}`);
  }
  mkdirSync(storeDir, { recursive: true });
  const file = configPath(storeDir);
  let cfg = {};
  if (existsSync(file)) {
    try { cfg = JSON.parse(readFileSync(file, 'utf8')) || {}; } catch { cfg = {}; }
  }
  cfg.surface = mode;
  writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n');
  return file;
}
