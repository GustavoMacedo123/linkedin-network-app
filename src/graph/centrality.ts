interface Edge { source: number; target: number; }

export function computeCentrality(
  nodeIds: number[],
  edges: Edge[]
): Map<number, number> {
  const adj = new Map<number, Set<number>>();
  for (const id of nodeIds) adj.set(id, new Set());
  for (const e of edges) {
    adj.get(e.source)?.add(e.target);
    adj.get(e.target)?.add(e.source);
  }

  const degree = new Map<number, number>();
  let maxDeg = 0;
  for (const [id, neighbors] of adj) {
    const d = neighbors.size;
    degree.set(id, d);
    if (d > maxDeg) maxDeg = d;
  }

  const scores = new Map<number, number>();
  for (const id of nodeIds) {
    const d = degree.get(id) ?? 0;
    scores.set(id, maxDeg === 0 ? 0 : d / maxDeg);
  }
  return scores;
}
