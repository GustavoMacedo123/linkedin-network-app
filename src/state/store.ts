import { create } from "zustand";
import type { EdgeRule } from "@/graph/synthEdges";

export interface PersonNode {
  id: number;
  first_name: string;
  last_name: string;
  company: string | null;
  title: string | null;
  archived: boolean;
  tagIds: number[];
}

export interface GraphState {
  persons: PersonNode[];
  setPersons: (p: PersonNode[]) => void;

  selectedId: number | null;
  setSelected: (id: number | null) => void;

  edgeRule: EdgeRule;
  setEdgeRule: (r: EdgeRule) => void;

  filterMode: "fade" | "isolate";
  setFilterMode: (m: "fade" | "isolate") => void;

  search: string;
  setSearch: (s: string) => void;

  selectedCompanies: Set<string>;
  toggleCompany: (c: string) => void;

  selectedTagIds: Set<number>;
  toggleTagId: (id: number) => void;

  showArchived: boolean;
  setShowArchived: (b: boolean) => void;

  tags: { id: number; name: string; color: string }[];
  setTags: (t: { id: number; name: string; color: string }[]) => void;

  savedViews: { id: number; name: string; filter: unknown }[];
  setSavedViews: (v: { id: number; name: string; filter: unknown }[]) => void;

  applyFilter: (f: { search?: string; companies?: string[]; tagIds?: number[] }) => void;

  noteMatchIds: Set<number> | null;
  setNoteMatchIds: (s: Set<number> | null) => void;

  settingsOpen: boolean;
  setSettingsOpen: (b: boolean) => void;
  reimporting: boolean;
  setReimporting: (b: boolean) => void;
  lastImportSummary: { added: number; updated: number; archived: number; snapshotPath: string } | null;
  setLastImportSummary: (s: { added: number; updated: number; archived: number; snapshotPath: string } | null) => void;
}

export const useStore = create<GraphState>(set => ({
  persons: [],
  setPersons: (p) => set({ persons: p }),

  selectedId: null,
  setSelected: (id) => set({ selectedId: id }),

  edgeRule: "company",
  setEdgeRule: (r) => set({ edgeRule: r }),

  filterMode: "fade",
  setFilterMode: (m) => set({ filterMode: m }),

  search: "",
  setSearch: (s) => set({ search: s }),

  selectedCompanies: new Set<string>(),
  toggleCompany: (c) => set(s => {
    const next = new Set(s.selectedCompanies);
    if (next.has(c)) next.delete(c); else next.add(c);
    return { selectedCompanies: next };
  }),

  selectedTagIds: new Set<number>(),
  toggleTagId: (id) => set(s => {
    const next = new Set(s.selectedTagIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    return { selectedTagIds: next };
  }),

  showArchived: false,
  setShowArchived: (b) => set({ showArchived: b }),

  tags: [],
  setTags: (t) => set({ tags: t }),

  savedViews: [],
  setSavedViews: (v) => set({ savedViews: v }),

  applyFilter: (f) => set({
    search: f.search ?? "",
    selectedCompanies: new Set(f.companies ?? []),
    selectedTagIds: new Set(f.tagIds ?? []),
  }),

  noteMatchIds: null,
  setNoteMatchIds: (s) => set({ noteMatchIds: s }),

  settingsOpen: false,
  setSettingsOpen: (b) => set({ settingsOpen: b }),
  reimporting: false,
  setReimporting: (b) => set({ reimporting: b }),
  lastImportSummary: null,
  setLastImportSummary: (s) => set({ lastImportSummary: s }),
}));
