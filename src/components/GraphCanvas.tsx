import { useMemo, useRef, useEffect } from "react";
import ForceGraph2D, { ForceGraphMethods } from "react-force-graph-2d";
import { useStore } from "@/state/store";
import { computeSyntheticEdges } from "@/graph/synthEdges";

const YOU_ID = 0;

export function GraphCanvas() {
  const persons = useStore(s => s.persons);
  const edgeRule = useStore(s => s.edgeRule);
  const setSelected = useStore(s => s.setSelected);
  const fgRef = useRef<ForceGraphMethods>();

  const data = useMemo(() => {
    const visible = persons.filter(p => !p.archived);
    const youNode = { id: YOU_ID, name: "You", isYou: true };
    const personNodes = visible.map(p => ({
      id: p.id,
      name: `${p.first_name} ${p.last_name}`,
      company: p.company,
      isYou: false,
    }));
    const edges = computeSyntheticEdges(
      visible.map(p => ({ id: p.id, company: p.company, title: p.title, tagIds: p.tagIds })),
      { rule: edgeRule, youId: YOU_ID }
    );
    return { nodes: [youNode, ...personNodes], links: edges };
  }, [persons, edgeRule]);

  useEffect(() => {
    fgRef.current?.zoomToFit(400, 60);
  }, [data]);

  return (
    <main className="bg-neutral-50 relative overflow-hidden">
      <ForceGraph2D
        ref={fgRef}
        graphData={data}
        nodeRelSize={5}
        backgroundColor="#fafafa"
        linkColor={() => "rgba(100,116,139,0.4)"}
        linkWidth={0.8}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const r = node.isYou ? 8 : 5;
          ctx.beginPath();
          ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, 2 * Math.PI);
          ctx.fillStyle = node.isYou ? "#fbbf24" : "#cbd5e1";
          ctx.fill();
          ctx.strokeStyle = "#475569";
          ctx.lineWidth = 1 / globalScale;
          ctx.stroke();
        }}
        onNodeClick={(node) => {
          if (typeof node.id === "number" && node.id !== YOU_ID) setSelected(node.id);
        }}
        cooldownTicks={120}
      />
    </main>
  );
}
