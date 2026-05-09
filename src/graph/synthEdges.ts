export interface GraphPerson {
  id: number;
  company: string | null;
  title: string | null;
  tagIds: number[];
}

export type EdgeRule = "company" | "tag" | "title-keyword" | "radial-only";

export interface SyntheticEdge {
  source: number;
  target: number;
}

export interface Options {
  rule: EdgeRule;
  youId: number;
}

export function computeSyntheticEdges(
  persons: GraphPerson[],
  opts: Options
): SyntheticEdge[] {
  const edges: SyntheticEdge[] = persons.map(p => ({ source: opts.youId, target: p.id }));
  if (opts.rule === "radial-only") return edges;

  const groups = new Map<string, number[]>();

  for (const p of persons) {
    const keys = keyFor(p, opts.rule);
    for (const k of keys) {
      const arr = groups.get(k);
      if (arr) arr.push(p.id);
      else groups.set(k, [p.id]);
    }
  }

  const seen = new Set<string>();
  for (const ids of groups.values()) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = Math.min(ids[i], ids[j]);
        const b = Math.max(ids[i], ids[j]);
        const key = `${a}-${b}`;
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push({ source: a, target: b });
      }
    }
  }

  return edges;
}

function keyFor(p: GraphPerson, rule: EdgeRule): string[] {
  switch (rule) {
    case "company":
      return p.company ? [`co:${p.company.toLowerCase()}`] : [];
    case "tag":
      return p.tagIds.map(t => `tag:${t}`);
    case "title-keyword":
      return tokenize(p.title ?? "").map(w => `kw:${w}`);
    case "radial-only":
      return [];
  }
}

const STOPWORDS = new Set(["the", "of", "and", "at", "in", "for", "to", "a", "an"]);
function tokenize(s: string): string[] {
  return s.toLowerCase().split(/\W+/).filter(w => w.length > 2 && !STOPWORDS.has(w));
}
