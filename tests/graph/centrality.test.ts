import { describe, it, expect } from "vitest";
import { computeCentrality } from "@/graph/centrality";

describe("computeCentrality", () => {
  it("returns scores in 0..1 range", () => {
    const scores = computeCentrality(
      [1, 2, 3, 4],
      [
        { source: 1, target: 2 }, { source: 2, target: 3 },
        { source: 3, target: 4 }, { source: 1, target: 3 },
      ]
    );
    for (const v of scores.values()) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("hub node has highest score in a star graph", () => {
    const scores = computeCentrality(
      [1, 2, 3, 4, 5],
      [
        { source: 1, target: 2 }, { source: 1, target: 3 },
        { source: 1, target: 4 }, { source: 1, target: 5 },
      ]
    );
    expect(scores.get(1)).toBeGreaterThan(scores.get(2)!);
    expect(scores.get(1)).toBeGreaterThan(scores.get(5)!);
  });
});
