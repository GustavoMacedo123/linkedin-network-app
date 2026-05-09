export function Sidebar() {
  return (
    <aside className="bg-white p-3 overflow-y-auto">
      <div className="text-xs font-bold text-neutral-400 mb-2">SEARCH</div>
      <input
        type="text"
        placeholder="Find someone…"
        className="w-full px-2 py-1.5 text-sm bg-neutral-50 border border-neutral-200 rounded"
      />
      <div className="mt-6 text-xs font-bold text-neutral-400">COMPANIES</div>
      <div className="mt-1 text-xs text-neutral-400 italic">No data yet</div>
    </aside>
  );
}
