import { describe, it, expect } from "vitest";
import { computeSyntheticEdges, type GraphPerson } from "@/graph/synthEdges";

const sarah: GraphPerson = { id: 1, company: "Stripe", title: "Eng", tagIds: [10] };
const john:  GraphPerson = { id: 2, company: "Stripe", title: "PM",  tagIds: [11] };
const lisa:  GraphPerson = { id: 3, company: "Google", title: "Eng", tagIds: [10] };
const max:   GraphPerson = { id: 4, company: null,     title: "Founder", tagIds: [] };

describe("computeSyntheticEdges (rule = company)", () => {
  it("creates radial 'you' edges to every person", () => {
    const edges = computeSyntheticEdges([sarah, john, lisa, max], { rule: "company", youId: 0 });
    const radial = edges.filter(e => e.source === 0);
    expect(radial.length).toBe(4);
  });

  it("links persons sharing a non-null company", () => {
    const edges = computeSyntheticEdges([sarah, john, lisa], { rule: "company", youId: 0 });
    const cross = edges.filter(e => e.source !== 0);
    expect(cross).toContainEqual(expect.objectContaining({ source: 1, target: 2 }));
    expect(cross.find(e => (e.source === 1 && e.target === 3) || (e.source === 3 && e.target === 1))).toBeUndefined();
  });

  it("ignores persons with null company", () => {
    const edges = computeSyntheticEdges([sarah, max], { rule: "company", youId: 0 });
    const cross = edges.filter(e => e.source !== 0);
    expect(cross.length).toBe(0);
  });

  it("rule = tag links persons sharing any tag", () => {
    const edges = computeSyntheticEdges([sarah, lisa, john], { rule: "tag", youId: 0 });
    const cross = edges.filter(e => e.source !== 0);
    expect(cross).toContainEqual(expect.objectContaining({ source: 1, target: 3 }));
    expect(cross.find(e => (e.source === 1 && e.target === 2))).toBeUndefined();
  });

  it("rule = radial-only produces only 'you' edges", () => {
    const edges = computeSyntheticEdges([sarah, john], { rule: "radial-only", youId: 0 });
    expect(edges.every(e => e.source === 0)).toBe(true);
  });

  it("does not produce duplicate edges", () => {
    const edges = computeSyntheticEdges([sarah, john], { rule: "company", youId: 0 });
    const ids = edges.map(e => `${e.source}-${e.target}`);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
