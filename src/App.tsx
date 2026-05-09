import { useEffect, useState, useCallback } from "react";
import { Layout } from "./components/Layout";
import { ImportDialog } from "./components/ImportDialog";
import { getDb, type Db } from "./db/client";
import { loadAllPersons } from "./db/persons";
import { useStore } from "./state/store";

export default function App() {
  const [db, setDb] = useState<Db | null>(null);
  const [personCount, setPersonCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const setPersons = useStore(s => s.setPersons);

  const refresh = useCallback(async (d: Db) => {
    const persons = await loadAllPersons(d);
    setPersons(persons);
    setPersonCount(persons.filter(p => !p.archived).length);
  }, [setPersons]);

  useEffect(() => {
    getDb().then(async d => {
      setDb(d);
      await refresh(d);
    }).catch(e => setError(String(e)));
  }, [refresh]);

  if (error) return <div className="p-8 text-red-600">DB error: {error}</div>;
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
