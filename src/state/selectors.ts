import type { PersonNode } from "./store";

export interface FilterState {
  search: string;
  companies: Set<string>;
  tagIds: Set<number>;
  showArchived: boolean;
}

export function matchesFilter(p: PersonNode, f: FilterState): boolean {
  if (p.archived && !f.showArchived) return false;

  if (f.companies.size > 0) {
    if (!p.company || !f.companies.has(p.company)) return false;
  }

  if (f.tagIds.size > 0) {
    if (!p.tagIds.some(id => f.tagIds.has(id))) return false;
  }

  const search = f.search.trim();
  if (search && !search.toLowerCase().startsWith("note:")) {
    const needle = search.toLowerCase();
    const hay = [p.first_name, p.last_name, p.company ?? "", p.title ?? ""].join(" ").toLowerCase();
    if (!hay.includes(needle)) return false;
  }

  return true;
}

export interface NetworkStats {
  total: number;
  topCompany: { name: string; count: number } | null;
  companyCount: number;
}

export function computeNetworkStats(persons: PersonNode[]): NetworkStats {
  const active = persons.filter(p => !p.archived);
  const total = active.length;

  // Group by normalised company key. Each group tracks how many people use each
  // original casing, so the top company can render with its most common spelling.
  const groups = new Map<string, { displayCounts: Map<string, number>; total: number }>();
  for (const p of active) {
    const raw = (p.company ?? "").trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    let g = groups.get(key);
    if (!g) {
      g = { displayCounts: new Map(), total: 0 };
      groups.set(key, g);
    }
    g.total += 1;
    g.displayCounts.set(raw, (g.displayCounts.get(raw) ?? 0) + 1);
  }

  const companyCount = groups.size;

  let top: { name: string; count: number } | null = null;
  for (const g of groups.values()) {
    const variants = [...g.displayCounts.entries()].sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
    });
    const displayName = variants[0][0];
    const isBetter =
      top === null ||
      g.total > top.count ||
      (g.total === top.count && displayName.toLowerCase() < top.name.toLowerCase());
    if (isBetter) top = { name: displayName, count: g.total };
  }

  return { total, topCompany: top, companyCount };
}
