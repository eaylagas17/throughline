import { findStore, listItems } from './lib/store.mjs';
import { renderSurface } from './lib/render.mjs';
import { gitRoot } from './lib/git.mjs';

const cwd = process.cwd();
const store = findStore(cwd, gitRoot(cwd));
const out = renderSurface(listItems(store || ''));
process.stdout.write((out || 'No throughline items in this project.') + '\n');
