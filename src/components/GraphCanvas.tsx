import { useMemo, useRef, useEffect } from "react";
import ForceGraph2D, { ForceGraphMethods } from "react-force-graph-2d";
import { useStore } from "@/state/store";
import { computeSyntheticEdges } from "@/graph/synthEdges";
import { detectCommunities } from "@/graph/community";
import { computeCentrality } from "@/graph/centrality";
import { assignColors } from "@/graph/colors";
import { convexHull, expandHull } from "@/graph/clusterRegions";

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
        onRenderFramePre={(ctx) => {
          const groups = new Map<string, { x: number; y: number }[]>();
          for (const n of (data.nodes as any[])) {
            if (n.isYou || n.color === "#cbd5e1") continue;
            if (typeof n.x !== "number" || typeof n.y !== "number") continue;
            const arr = groups.get(n.color);
            if (arr) arr.push({ x: n.x, y: n.y });
            else groups.set(n.color, [{ x: n.x, y: n.y }]);
          }
          for (const [color, pts] of groups) {
            if (pts.length < 3) continue;
            const hull = expandHull(convexHull(pts), 14);
            ctx.beginPath();
            ctx.moveTo(hull[0].x, hull[0].y);
            for (let i = 1; i < hull.length; i++) ctx.lineTo(hull[i].x, hull[i].y);
            ctx.closePath();
            ctx.fillStyle = color + "26";
            ctx.fill();
          }
        }}
        nodeCanvasObject={(node: any, ctx, globalScale) => {
          ctx.beginPath();
          ctx.arc(node.x ?? 0, node.y ?? 0, node.size, 0, 2 * Math.PI);
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
