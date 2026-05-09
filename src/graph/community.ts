import Graph from "graphology";
import louvain from "graphology-communities-louvain";

interface Edge { source: number; target: number; }

export function detectCommunities(
  nodeIds: number[],
  edges: Edge[]
): Map<number, number> {
  const g = new Graph({ type: "undirected", multi: false, allowSelfLoops: false });
  for (const id of nodeIds) g.addNode(String(id));
  for (const e of edges) {
    if (e.source === e.target) continue;
    if (!g.hasEdge(String(e.source), String(e.target))) {
      g.addEdge(String(e.source), String(e.target));
    }
  }
  const result = louvain(g);
  const map = new Map<number, number>();
  for (const [k, v] of Object.entries(result)) map.set(Number(k), v as number);
  return map;
}
