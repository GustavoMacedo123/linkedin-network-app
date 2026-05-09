import { useMemo, useRef, useEffect } from "react";
import ForceGraph2D, { ForceGraphMethods } from "react-force-graph-2d";
import { useStore } from "@/state/store";
import { computeSyntheticEdges } from "@/graph/synthEdges";
import { detectCommunities } from "@/graph/community";
import { computeCentrality } from "@/graph/centrality";
import { assignColors } from "@/graph/colors";

const YOU_ID = 0;

interface NodeDatum {
  id: number;
  name: string;
  isYou: boolean;
  color: string;
  size: number;
}

export function GraphCanvas() {
  const persons = useStore(s => s.persons);
  const edgeRule = useStore(s => s.edgeRule);
  const setSelected = useStore(s => s.setSelected);
  const fgRef = useRef<ForceGraphMethods>();

  const data = useMemo(() => {
    const visible = persons.filter(p => !p.archived);
    const ids = [YOU_ID, ...visible.map(p => p.id)];

    const edges = computeSyntheticEdges(
      visible.map(p => ({ id: p.id, company: p.company, title: p.title, tagIds: p.tagIds })),
      { rule: edgeRule, youId: YOU_ID }
    );

    const communities = detectCommunities(ids, edges);
    const colorMap = assignColors([...communities.values()]);
    const centrality = computeCentrality(ids, edges);

    const nodes: NodeDatum[] = ids.map(id => {
      if (id === YOU_ID) {
        return { id, name: "You", isYou: true, color: "#fbbf24", size: 10 };
      }
      const p = visible.find(pp => pp.id === id)!;
      const cId = communities.get(id) ?? -1;
      const color = colorMap.get(cId) ?? "#cbd5e1";
      const c = centrality.get(id) ?? 0;
      return {
        id,
        name: `${p.first_name} ${p.last_name}`,
        isYou: false,
        color,
        size: 4 + c * 6,
      };
    });

    return { nodes, links: edges };
  }, [persons, edgeRule]);

  useEffect(() => {
    fgRef.current?.zoomToFit(400, 60);
  }, [data]);

  return (
    <main className="bg-neutral-50 relative overflow-hidden">
      <ForceGraph2D
        ref={fgRef}
        graphData={data}
        backgroundColor="#fafafa"
        linkColor={() => "rgba(100,116,139,0.4)"}
        linkWidth={0.8}
        nodeCanvasObject={(node: any, ctx, globalScale) => {
          const r = node.size;
          ctx.beginPath();
          ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, 2 * Math.PI);
          ctx.fillStyle = node.color;
          ctx.fill();
          ctx.strokeStyle = "#334155";
          ctx.lineWidth = 1 / globalScale;
          ctx.stroke();
        }}
        nodeLabel={(node: any) => node.name}
        onNodeClick={(node: any) => {
          if (typeof node.id === "number" && node.id !== YOU_ID) setSelected(node.id);
        }}
        cooldownTicks={150}
      />
    </main>
  );
}
