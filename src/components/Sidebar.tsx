import { useMemo } from "react";
import { useStore } from "@/state/store";
import { matchesFilter } from "@/state/selectors";

export function Sidebar() {
  const persons = useStore(s => s.persons);
  const search = useStore(s => s.search);
  const setSearch = useStore(s => s.setSearch);
  const selectedCompanies = useStore(s => s.selectedCompanies);
  const toggleCompany = useStore(s => s.toggleCompany);
  const selectedTagIds = useStore(s => s.selectedTagIds);
  const showArchived = useStore(s => s.showArchived);
  const setShowArchived = useStore(s => s.setShowArchived);

  const visible = useMemo(
    () => persons.filter(p => matchesFilter(p, {
      search,
      companies: selectedCompanies,
      tagIds: selectedTagIds,
      showArchived,
    })),
    [persons, search, selectedCompanies, selectedTagIds, showArchived]
  );

  const companyCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of visible) {
      if (!p.company) continue;
      m.set(p.company, (m.get(p.company) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [visible]);

  return (
    <aside className="bg-white p-3 overflow-y-auto flex flex-col gap-5">
      <div>
        <div className="text-xs font-bold text-neutral-400 mb-1.5">SEARCH</div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Find someone… (note: prefix searches notes)"
          className="w-full px-2 py-1.5 text-sm bg-neutral-50 border border-neutral-200 rounded focus:outline-none focus:ring-1 focus:ring-neutral-400"
        />
      </div>

      <div>
        <div className="text-xs font-bold text-neutral-400 mb-1.5">COMPANIES</div>
        <ul className="text-sm space-y-0.5">
          {companyCounts.slice(0, 12).map(([co, n]) => {
            const active = selectedCompanies.has(co);
            return (
              <li key={co}>
                <button
                  onClick={() => toggleCompany(co)}
                  className={`w-full flex items-center gap-2 px-1.5 py-0.5 rounded text-left ${active ? "bg-neutral-100 font-medium" : "hover:bg-neutral-50"}`}
                >
                  <span className="w-2 h-2 rounded-full bg-neutral-300" />
                  <span className="flex-1 truncate">{co}</span>
                  <span className="text-xs text-neutral-400 tabular-nums">{n}</span>
                </button>
              </li>
            );
          })}
          {companyCounts.length === 0 && (
            <li className="text-xs italic text-neutral-400 px-1">No companies in current view</li>
          )}
        </ul>
      </div>

      <div>
        <label className="flex items-center gap-2 text-xs text-neutral-600">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived ({persons.filter(p => p.archived).length})
        </label>
      </div>
    </aside>
  );
}
