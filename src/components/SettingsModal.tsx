import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "@/state/store";
import { getDb } from "@/db/client";
import type { EdgeRule } from "@/graph/synthEdges";

const EDGE_RULES: { value: EdgeRule; label: string }[] = [
  { value: "company", label: "Same company" },
  { value: "tag", label: "Same tag" },
  { value: "title-keyword", label: "Same title keyword" },
  { value: "radial-only", label: "Radial only (no person-to-person)" },
];

export function SettingsModal() {
  const open = useStore(s => s.settingsOpen);
  const setOpen = useStore(s => s.setSettingsOpen);
  const edgeRule = useStore(s => s.edgeRule);
  const setEdgeRule = useStore(s => s.setEdgeRule);
  const filterMode = useStore(s => s.filterMode);
  const setFilterMode = useStore(s => s.setFilterMode);
  const [lastImport, setLastImport] = useState<{ imported_at: string; file_name: string | null } | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const db = await getDb();
      const rows = await db.select<{ imported_at: string; file_name: string | null }>(
        "SELECT imported_at, file_name FROM import_session ORDER BY imported_at DESC LIMIT 1"
      );
      setLastImport(rows[0] ?? null);
    })();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setOpen(false)}>
      <div
        className="bg-white rounded-lg shadow-xl w-[600px] max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-neutral-200 flex items-center justify-between">
          <div className="font-semibold">Settings</div>
          <button onClick={() => setOpen(false)} className="text-neutral-400 hover:text-neutral-900">✕</button>
        </div>

        <div className="px-5 py-4 border-b border-neutral-200">
          <div className="text-xs font-bold text-neutral-400 mb-2">DATA</div>
          <div className="text-sm text-neutral-700">
            Last imported: {lastImport ? `${lastImport.imported_at}${lastImport.file_name ? ` (${lastImport.file_name})` : ""}` : "Never"}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => invoke("open_data_dir").catch(console.error)}
              className="px-3 py-1.5 text-sm border border-neutral-300 rounded hover:bg-neutral-50"
            >Open data folder</button>
          </div>
        </div>

        <div className="px-5 py-4 border-b border-neutral-200">
          <div className="text-xs font-bold text-neutral-400 mb-2">GRAPH</div>
          <label className="flex items-center justify-between text-sm py-1">
            <span>Edge rule</span>
            <select
              value={edgeRule}
              onChange={(e) => setEdgeRule(e.target.value as EdgeRule)}
              className="border border-neutral-300 rounded px-2 py-1 text-sm"
            >
              {EDGE_RULES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
          <label className="flex items-center justify-between text-sm py-1">
            <span>Filter mode</span>
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value as "fade" | "isolate")}
              className="border border-neutral-300 rounded px-2 py-1 text-sm"
            >
              <option value="fade">Fade non-matches</option>
              <option value="isolate">Isolate matches</option>
            </select>
          </label>
        </div>

        <div className="px-5 py-4">
          <div className="text-xs font-bold text-neutral-400 mb-2">ABOUT</div>
          <div className="text-sm text-neutral-700">Network · v0.1.0</div>
          <div className="text-xs text-neutral-500 mt-1">All data stays on this machine. No network calls.</div>
        </div>
      </div>
    </div>
  );
}
