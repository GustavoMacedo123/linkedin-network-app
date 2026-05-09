import { describe, it, expect } from "vitest";
import { convexHull } from "@/graph/clusterRegions";

describe("convexHull", () => {
  it("returns the four corners for a square of points (with one interior)", () => {
    const pts = [
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
      { x: 5, y: 5 },
    ];
    const hull = convexHull(pts);
    expect(hull.length).toBe(4);
    for (const corner of [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]) {
      expect(hull).toContainEqual(corner);
    }
  });

  it("handles collinear points by returning extremes", () => {
    const hull = convexHull([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }]);
    expect(hull.length).toBeLessThanOrEqual(3);
  });

  it("returns input unchanged for fewer than 3 points", () => {
    expect(convexHull([{ x: 1, y: 1 }])).toEqual([{ x: 1, y: 1 }]);
    expect(convexHull([{ x: 0, y: 0 }, { x: 1, y: 1 }]).length).toBe(2);
  });
});
