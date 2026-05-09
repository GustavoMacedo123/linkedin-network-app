import { describe, it, expect } from "vitest";
import { COMMUNITY_PALETTE, assignColors } from "@/graph/colors";

describe("assignColors", () => {
  it("assigns palette colors to communities by descending size", () => {
    // community 30 has 5 members, 20 has 4, 10 has 3
    const map = assignColors([10, 10, 10, 20, 20, 20, 20, 30, 30, 30, 30, 30]);
    expect(map.get(30)).toBe(COMMUNITY_PALETTE[0]);
    expect(map.get(20)).toBe(COMMUNITY_PALETTE[1]);
    expect(map.get(10)).toBe(COMMUNITY_PALETTE[2]);
  });

  it("falls back to gray for communities with fewer than 3 members", () => {
    const map = assignColors([1, 1, 2, 3, 3, 3]);
    expect(map.get(1)).toBe("#cbd5e1");
    expect(map.get(2)).toBe("#cbd5e1");
    expect(map.get(3)).toBe(COMMUNITY_PALETTE[0]);
  });

  it("wraps around when community count exceeds palette", () => {
    const ids = Array(20).fill(0).map((_, i) => i);
    const sized = ids.flatMap(i => Array(5).fill(i));
    const map = assignColors(sized);
    expect(map.size).toBe(20);
    expect(map.get(0)).toBeDefined();
    expect(map.get(19)).toBeDefined();
  });
});
