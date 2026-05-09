import { useEffect, useMemo } from "react";
import { useStore } from "@/state/store";
import { matchesFilter } from "@/state/selectors";
import { getDb } from "@/db/client";
import { createSavedView, deleteSavedView, listSavedViews } from "@/db/savedViews";
import { searchNotes } from "@/search/notes";

export function Sidebar() {
  const persons = useStore(s => s.persons);
  const search = useStore(s => s.search);
  const setSearch = useStore(s => s.setSearch);
  const selectedCompanies = useStore(s => s.selectedCompanies);
  const toggleCompany = useStore(s => s.toggleCompany);
  const selectedTagIds = useStore(s => s.selectedTagIds);
  const toggleTagId = useStore(s => s.toggleTagId);
  const tags = useStore(s => s.tags);
  const savedViews = useStore(s => s.savedViews);
  const setSavedViews = useStore(s => s.setSavedViews);
  const applyFilter = useStore(s => s.applyFilter);
  const showArchived = useStore(s => s.showArchived);
  const setShowArchived = useStore(s => s.setShowArchived);
  const noteMatchIds = useStore(s => s.noteMatchIds);
  const setNoteMatchIds = useStore(s => s.setNoteMatchIds);
  const setSettingsOpen = useStore(s => s.setSettingsOpen);
  const setReimporting = useStore(s => s.setReimporting);

  useEffect(() => {
    if (!search.trim().toLowerCase().startsWith("note:")) {
      setNoteMatchIds(null);
      return;
    }
    const q = search.trim().slice(5).trim();
    if (!q) { setNoteMatchIds(new Set()); return; }
    let cancelled = false;
    (async () => {
      const db = await getDb();
      const ids = await searchNotes(db, q);
      if (!cancelled) setNoteMatchIds(new Set(ids));
    })();
    return () => { cancelled = true; };
  }, [search, setNoteMatchIds]);

  async function saveCurrentView() {
    const name = prompt("Name this view:");
    if (!name) return;
    const db = await getDb();
    await createSavedView(db, name, {
      search,
      companies: [...selectedCompanies],
      tagIds: [...selectedTagIds],
    });
    setSavedViews(await listSavedViews(db));
  }

  async function removeSavedView(id: number) {
    const db = await getDb();
    await deleteSavedView(db, id);
    setSavedViews(await listSavedViews(db));
  }

  const visible = useMemo(
    () => persons.filter(p => {
      if (noteMatchIds !== null && !noteMatchIds.has(p.id)) return false;
      return matchesFilter(p, {
        search,
        companies: selectedCompanies,
        tagIds: selectedTagIds,
        showArchived,
      });
    }),
    [persons, search, selectedCompanies, selectedTagIds, showArchived, noteMatchIds]
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
        <div className="text-xs font-bold text-neutral-400 mb-1.5">TAGS</div>
        {tags.length === 0 ? (
          <div className="text-xs italic text-neutral-400">Add tags from a person's profile.</div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {tags.map(t => {
              const active = selectedTagIds.has(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => toggleTagId(t.id)}
                  className={`px-2 py-0.5 text-xs rounded-full border ${active ? "ring-2 ring-neutral-700" : ""}`}
                  style={{ backgroundColor: t.color, borderColor: t.color }}
                >
                  {t.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-xs font-bold text-neutral-400">SAVED VIEWS</div>
          <button onClick={saveCurrentView} className="text-xs text-neutral-500 hover:text-neutral-900">+ save</button>
        </div>
        {savedViews.length === 0 ? (
          <div className="text-xs italic text-neutral-400">Save the current filter for quick access.</div>
        ) : (
          <ul className="text-sm space-y-0.5">
            {savedViews.map(v => (
              <li key={v.id} className="flex items-center group">
                <button
                  onClick={() => applyFilter(v.filter as { search?: string; companies?: string[]; tagIds?: number[] })}
                  className="flex-1 text-left px-1.5 py-0.5 rounded hover:bg-neutral-50 truncate"
                >★ {v.name}</button>
                <button
                  onClick={() => removeSavedView(v.id)}
                  className="text-xs text-neutral-300 hover:text-red-500 px-1 opacity-0 group-hover:opacity-100"
                  aria-label={`Delete ${v.name}`}
                >✕</button>
              </li>
            ))}
          </ul>
        )}
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

      <div className="mt-auto pt-4 border-t border-neutral-100 flex gap-2">
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex-1 px-2 py-1.5 text-xs border border-neutral-200 rounded hover:bg-neutral-50"
        >⚙ Settings</button>
        <button
          onClick={() => setReimporting(true)}
          className="flex-1 px-2 py-1.5 text-xs border border-neutral-200 rounded hover:bg-neutral-50"
        >📥 Import</button>
      </div>
    </aside>
  );
}
