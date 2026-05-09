import { describe, it, expect } from "vitest";
import { detectCommunities } from "@/graph/community";

describe("detectCommunities", () => {
  it("identifies two communities in a barbell-style graph", () => {
    const nodes = [1, 2, 3, 4, 5, 6];
    const edges = [
      { source: 1, target: 2 }, { source: 2, target: 3 }, { source: 1, target: 3 },
      { source: 4, target: 5 }, { source: 5, target: 6 }, { source: 4, target: 6 },
      { source: 3, target: 4 },
    ];
    const communities = detectCommunities(nodes, edges);
    expect(communities.get(1)).toBe(communities.get(2));
    expect(communities.get(2)).toBe(communities.get(3));
    expect(communities.get(4)).toBe(communities.get(5));
    expect(communities.get(5)).toBe(communities.get(6));
    expect(communities.get(1)).not.toBe(communities.get(4));
  });

  it("returns single community for fully connected graph", () => {
    const nodes = [1, 2, 3];
    const edges = [
      { source: 1, target: 2 }, { source: 2, target: 3 }, { source: 1, target: 3 },
    ];
    const communities = detectCommunities(nodes, edges);
    const ids = new Set(communities.values());
    expect(ids.size).toBe(1);
  });

  it("each isolated node ends up in its own community", () => {
    const communities = detectCommunities([1, 2, 3], []);
    const ids = new Set(communities.values());
    expect(ids.size).toBe(3);
  });
});
