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
