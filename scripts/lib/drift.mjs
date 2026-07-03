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
