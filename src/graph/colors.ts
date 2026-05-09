export const COMMUNITY_PALETTE = [
  "#a78bfa", "#34d399", "#fb923c", "#60a5fa",
  "#f472b6", "#fbbf24", "#22d3ee", "#a3e635",
  "#f87171", "#c084fc", "#2dd4bf", "#fdba74",
];
const FALLBACK_GRAY = "#cbd5e1";
const MIN_SIZE = 3;

export function assignColors(communityIds: number[]): Map<number, string> {
  const sizes = new Map<number, number>();
  for (const id of communityIds) sizes.set(id, (sizes.get(id) ?? 0) + 1);

  const sorted = [...sizes.entries()].sort((a, b) => b[1] - a[1]);
  const map = new Map<number, string>();
  let paletteIdx = 0;
  for (const [id, size] of sorted) {
    if (size < MIN_SIZE) {
      map.set(id, FALLBACK_GRAY);
    } else {
      map.set(id, COMMUNITY_PALETTE[paletteIdx % COMMUNITY_PALETTE.length]);
      paletteIdx++;
    }
  }
  return map;
}
