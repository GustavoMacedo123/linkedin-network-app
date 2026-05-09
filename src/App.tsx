import { useEffect, useState, useCallback } from "react";
import { Layout } from "./components/Layout";
import { ImportDialog } from "./components/ImportDialog";
import { getDb, type Db } from "./db/client";
import { loadAllPersons } from "./db/persons";
import { listTags } from "./db/tags";
import { listSavedViews } from "./db/savedViews";
import { useStore } from "./state/store";

export default function App() {
  const [db, setDb] = useState<Db | null>(null);
  const [personCount, setPersonCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const setPersons = useStore(s => s.setPersons);
  const setTags = useStore(s => s.setTags);
  const setSavedViews = useStore(s => s.setSavedViews);

  const refresh = useCallback(async (d: Db) => {
    const [persons, tags, savedViews] = await Promise.all([
      loadAllPersons(d),
      listTags(d),
      listSavedViews(d),
    ]);
    setPersons(persons);
    setTags(tags);
    setSavedViews(savedViews);
    setPersonCount(persons.filter(p => !p.archived).length);
  }, [setPersons, setTags, setSavedViews]);

  useEffect(() => {
    getDb().then(async d => {
      setDb(d);
      await refresh(d);
      import("@tauri-apps/api/core").then(({ invoke }) =>
        invoke("prune_old_snapshots", { maxAgeDays: 7 }).catch(() => {})
      );
    }).catch(e => setError(String(e)));
  }, [refresh]);

  if (error) {
    return (
      <div className="p-8 max-w-lg mx-auto text-sm">
        <div className="text-red-600 font-semibold mb-2">Database error</div>
        <div className="text-neutral-600 mb-4 break-all">{error}</div>
        <div className="text-neutral-500">
          If this keeps happening, the SQLite file may be corrupted. You can restore from a backup
          in <code>backup/</code> inside your data folder, or delete <code>data.sqlite</code> to start fresh
          (you'll lose your notes and tags — only do this as a last resort).
        </div>
        <button
          onClick={() => import("@tauri-apps/api/core").then(({ invoke }) => invoke("open_data_dir"))}
          className="mt-4 px-3 py-1.5 text-sm border border-neutral-300 rounded hover:bg-neutral-50"
        >Open data folder</button>
      </div>
    );
  }
  if (!db || personCount === null) return <div className="p-8 text-neutral-500">Loading…</div>;

  if (personCount === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-neutral-50">
        <ImportDialog db={db} onComplete={() => refresh(db)} />
      </div>
    );
  }

  return <Layout />;
}
