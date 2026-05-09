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
