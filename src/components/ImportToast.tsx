import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "@/state/store";
import { getDb } from "@/db/client";
import { loadAllPersons } from "@/db/persons";

export function ImportToast() {
  const summary = useStore(s => s.lastImportSummary);
  const setSummary = useStore(s => s.setLastImportSummary);
  const setPersons = useStore(s => s.setPersons);
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!summary) return;
    setHidden(false);
    const t = setTimeout(() => setHidden(true), 12_000);
    return () => clearTimeout(t);
  }, [summary]);

  if (!summary || hidden) return null;

  async function undo() {
    if (!summary) return;
    setBusy(true);
    try {
      await invoke("restore_snapshot", { snapshotPath: summary.snapshotPath });
      const db = await getDb();
      setPersons(await loadAllPersons(db));
      setSummary(null);
    } catch (e) {
      alert(`Undo failed: ${e}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 bg-neutral-900 text-white text-sm px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-40">
      <span>
        Imported · {summary.added} added · {summary.updated} updated · {summary.archived} archived
        {summary.warnings.length > 0 && (
          <span className="ml-2 text-yellow-300" title={summary.warnings.join("\n")}>
            ⚠ {summary.warnings.length} warning{summary.warnings.length === 1 ? "" : "s"}
          </span>
        )}
      </span>
      <button
        onClick={undo}
        disabled={busy}
        className="px-2 py-1 text-xs border border-white/30 rounded hover:bg-white/10 disabled:opacity-50"
      >{busy ? "Undoing…" : "Undo"}</button>
      <button onClick={() => setHidden(true)} aria-label="Dismiss" className="text-white/60 hover:text-white">✕</button>
    </div>
  );
}
